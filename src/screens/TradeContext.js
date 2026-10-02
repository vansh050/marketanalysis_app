// TradeContext.js
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';
import {AppState} from 'react-native';
import {subscribePortfolioResume} from '../utils/portfolioResume';
import {getAuth} from '@react-native-firebase/auth';
import server from '../utils/serverConfig';
import {fetchFunds} from '../FunctionCall/fetchFunds';
import {holdingsRefreshKey} from '../utils/holdingsRefreshKey';
import {fetchBrokerAllHoldings} from '../FunctionCall/fetchBrokerAllHoldings';
import {fetchBrokerSpecificHoldings} from '../FunctionCall/fetchBrokerSpecificHoldings';
import {fetchOrderBook, fetchPendingOrders} from '../services/BrokerOrderBookAPI';

import {getConfigData, isUserDataComplete} from '../utils/storageUtils';
import Config from 'react-native-config';
const TradeContext = createContext();

import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';
import {getAccountEmailAsync, useAccountEmail} from '../utils/accountEmail';
import {isRetiredEntryLeg, hasClosureContext, collapseRetiredEntries} from '../utils/basketUtils';
import {isOrderRejected} from '../utils/orderStatusUtils';
import {isBasketCustomerVisibleStatus} from '../utils/basketOrderState';
import {isWithdrawnUnfilledEntry} from '../utils/adviceDisplay';
import {saveBrokerSessionTime} from '../utils/brokerSessionUtils';
import {
  loadBrokerHoldingsSnapshot,
  loadBrokerHoldingsSummary,
  saveBrokerHoldingsSnapshot,
  saveBrokerHoldingsSummary,
} from '../utils/brokerHoldingsSnapshot';
import {
  normalizeRepairError,
  normalizeRepairResponse,
} from '../utils/rebalanceReconciliation';
import {confirmedFundsSnapshot} from '../utils/fundsDisplay';
import eventEmitter from '../components/EventEmitter';
import {getCustomerAuthHeaders} from '../utils/customerAuthHeaders';
export const useTrade = () => {
  return useContext(TradeContext);
};

const checkValidApiAnSecret = data => {
  if (!data) return null;
  try {
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  } catch (error) {
    console.error('Error during decryption:', error.message);
  }
  // Decrypt-or-passthrough: plaintext credentials (e.g. Zerodha's API key)
  // must be sent as-is (2026-08-13).
  return data;
};

export const TradeProvider = ({children}) => {
  const [stockRecoNotExecutedfinal, setstockRecoNotExecutedfinal] = useState(
    [],
  );
  const [recommendationStockfinal, setrecommendationStockfinal] = useState([]);
  const [isDatafetching, setIsDatafetching] = useState(false);
  const [isDatafetchingvideos, setIsDatafetchingvideos] = useState(false);
  const [rejectedTrades, setrejectedTrades] = useState([]);
  const [ignoredTrades, setIgnoredTrades] = useState([]);
  const [isBrokerConnected, setIsBrokerConnected] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  // Identity comes from the shared resolver: a usable Firebase email wins,
  // otherwise the address the user verified on EmailScreenAppleLogin. This is
  // reactive because the identity can resolve AFTER mount (cold start, or an
  // Apple sign-in where the auth listener fires before the email is confirmed)
  // and the effects below gate on it. See src/utils/accountEmail.js.
  const userEmail = useAccountEmail();

  const [configData, setConfigData] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [adviceShowDays, setAdviceShowDays] = useState(15);
  // Closed/withdrawn records stay visible this many days AFTER their closure
  // (product rule 2026-08-21), configurable via Admin Settings like the
  // advice window. Fallback 7.
  const [terminalClosedExtraDays, setTerminalClosedExtraDays] = useState(7);

  // ENHANCED: Load stored data with retry mechanism and better logging
  const loadStoredData = useCallback(async (retryCount = 3) => {
    try {
      const dataCheck = await isUserDataComplete();
      if (!dataCheck.isComplete) {
        if (retryCount > 0) {
          setTimeout(() => loadStoredData(retryCount - 1), 1000);
          return;
        } else {
          setConfigData(null);
          setConfigLoading(false);
          return;
        }
      }
      const config = await getConfigData();
      if (config) {
        setConfigData(config);
        setConfigLoading(false);
        console.log('✅ [TradeContext] Config data loaded successfully');
      } else {
        // If no config and we have retries left, wait and try again
        if (retryCount > 0) {
          setTimeout(() => loadStoredData(retryCount - 1), 1000);
          return;
        } else {
          setConfigData(null);
          setConfigLoading(false);
        }
      }
    } catch (error) {
      // Retry on error if we have attempts left
      if (retryCount > 0) {
        setTimeout(() => loadStoredData(retryCount - 1), 1000);
        return;
      } else {
        setConfigData(null);
        setConfigLoading(false);
      }
    }
  }, []);

  // ENHANCED: Force reload config data (called from login/signup flows)
  const reloadConfigData = useCallback(async () => {
    setConfigLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadStoredData(3); // Retry up to 3 times
  }, [loadStoredData]);

  useEffect(() => {
    loadStoredData();
  }, [loadStoredData]);

  const fetchAdviceShowDays = useCallback(async () => {
    try {
      const subdomain =
        configData?.config?.REACT_APP_HEADER_NAME ||
        configData?.subdomain ||
        'common';
      const response = await axios.get(
        `${server.server.baseUrl}api/admin/frontend-config`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': subdomain,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 15000,
        },
      );
      const days = Number(response.data?.data?.adviceShowLatestDays);
      if (days && days >= 1 && days <= 365) {
        setAdviceShowDays(days);
      }
      const terminalDays = Number(response.data?.data?.terminalClosedExtraDays);
      if (terminalDays && terminalDays >= 0 && terminalDays <= 365) {
        setTerminalClosedExtraDays(terminalDays);
      }
    } catch (error) {
      console.warn('Failed to fetch frontend config, using default 15 days:', error.message);
    }
  }, [configData]);

  useEffect(() => {
    if (configData) {
      fetchAdviceShowDays();
    }
  }, [configData, fetchAdviceShowDays]);

  const advisortag = configData?.config?.REACT_APP_ADVISOR_TAG;
  const advisorspecific = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
  const showAdviceStatusDays = adviceShowDays;

  const [modelPortfolioStrategyfinal, setModelPortfolioStrategyfinal] =
    useState([]);
  const [isDatafetchinMP, setIsDatafetchingMP] = useState(false);
  // This is the single client-side readiness flag for the server-filtered
  // active-model entitlement query. Consumers must not infer entitlement from
  // historical holdings or catalog metadata while it is unresolved.
  const [modelPortfolioEntitlementsLoaded, setModelPortfolioEntitlementsLoaded] =
    useState(false);
  const [modelPortfolioEntitlementsStatus, setModelPortfolioEntitlementsStatus] =
    useState('idle');
  const modelPortfolioRequestRef = useRef(null);
  const modelPortfolioRequestGenerationRef = useRef(0);
  const modelPortfolioHasSuccessfulResponseRef = useRef(false);

  useEffect(() => {
    modelPortfolioRequestGenerationRef.current += 1;
    modelPortfolioRequestRef.current = null;
    modelPortfolioHasSuccessfulResponseRef.current = false;
    // Last-known-good data is preserved across transient failures, but never
    // across an account/advisor identity boundary.
    setModelPortfolioStrategyfinal([]);
    setModelPortfolioEntitlementsLoaded(false);
    setModelPortfolioEntitlementsStatus('idle');
  }, [userEmail, configData?.config?.REACT_APP_HEADER_NAME]);

  // Repair-trades state — auto-fetched after MP strategies load.
  // Each entry: { modelName, uniqueId, userBroker, failedTrades[], message, modelId }
  // See docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g (repair UI) and
  // docs/WEB_MP_PARITY_TASKS.md § Task 4 for the contract.
  const [modelPortfolioRepairTrades, setModelPortfolioRepairTrades] = useState(
    [],
  );
  const [isDatafetchinRepair, setIsDatafetchingRepair] = useState(false);
  const [repairReconciliation, setRepairReconciliation] = useState({
    pending: false,
    unknown: false,
    checking: false,
    autoRetryScheduled: false,
    retryAfterSeconds: 0,
    accountRecovery: null,
  });
  const repairRetryTimerRef = useRef(null);
  const repairRetryCountRef = useRef(0);
  const repairWasReconcilingRef = useRef(false);
  const repairRequestSequenceRef = useRef(0);
  // Only one broker-backed Repair verification may run at a time. Screen
  // refreshes can arrive from several effects at once; letting each one call
  // the broker independently made Groww queue the same order-book read and
  // left the cards spinning. A manual card action supersedes the background
  // request, while duplicate background requests simply reuse the active
  // verification window.
  const repairRequestInFlightRef = useRef(null);
  // Last CLEAN get-repair answer (2026-10-02). The Home refresh usually asks
  // seconds before an Accept tap; the tap may reuse it instead of a second
  // 4-10 s server round-trip. Only clean answers are kept (nothing pending or
  // unknown, account not blocked); any reconnect, broker change or placed
  // order drops it. /rebalance/calculate still runs its own server barrier.
  const lastRepairResultRef = useRef(null);
  const repairEpochRef = useRef(0);
  // Bypass repair-mode shortcut on a card after the user explicitly clicks
  // Accept on a fresh rebalance. Keyed by `model_Id` of the rebalance event;
  // value is `true` when that card should ignore its repair entry for the
  // remainder of the session. Mirrors web's `skipRepairRef` in
  // prod-alphaquark-github/src/Home/ModelPortfolioSection/RebalanceCard.js:143.
  const skipRepairForModelIdsRef = useRef({});

  const isValidSymbolExpiry = (symbol, exchange) => {
    // Only filter NFO and BFO exchanges
    if (exchange !== 'NFO' && exchange !== 'BFO') {
      return true; // Accept all other exchanges
    }

    if (!symbol) {
      return false;
    }

    // This handles symbols like AXISBANK30SEP251180CE, NIFTY16SEP2525250CE
    const expiryRegex =
      /(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})/i;

    const match = symbol.match(expiryRegex);
    if (!match) {
      return false;
    }

    try {
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toUpperCase();
      const yearStr = match[3]; // Only the first 2 digits after month

      const monthMap = {
        JAN: 0,
        FEB: 1,
        MAR: 2,
        APR: 3,
        MAY: 4,
        JUN: 5,
        JUL: 6,
        AUG: 7,
        SEP: 8,
        OCT: 9,
        NOV: 10,
        DEC: 11,
      };

      const monthIndex = monthMap[monthStr];
      if (monthIndex === undefined) {
        return false;
      }

      // Convert 2-digit year to full year (25 -> 2025)
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      let year = currentCentury + parseInt(yearStr, 10);

      // Handle century rollover if needed
      if (year < currentYear - 10) {
        year += 100;
      }

      // Create expiry date - set to end of expiry day
      const expiryDate = new Date(year, monthIndex, day, 23, 59, 59, 999);

      // Get today's date (start of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isValid = expiryDate >= today;
      return isValid;
    } catch (error) {
      return false;
    }
  };

  // Updated helper function to filter out conflicting BUY/SELL orders for same symbol in basket
  // Add this debug function in your TradeProvider
  const debugBasketProcessing = (basketAdvice, basketName) => {
    // Debug logging can be enabled/disabled here
  };

  /**
   * Net basket trades by symbol - consolidates multiple trades of same symbol
   * For regular baskets: Calculates net position (BUY - SELL)
   * For closure baskets: De-duplicates by symbol, uses toTradeQty
   * @param {Array} trades - Array of basket trades
   * @returns {Array} - Netted trades array
   */
  const netBasketTrades = (trades) => {
    if (!trades || trades.length === 0) return [];

    // 2026-08-21: closure rows gate on REAL closure context (advisor exit
    // advice / executed closure), never on the feed's POSITION_OPEN
    // projection flag — the lifecycle stamps isClosure=true + toTradeQty on
    // every leg of a symbol the customer holds, even with no closure
    // instruction. Retired manual-entry advice rows are history and never
    // enter the net (their fill lives on the linked manual_entry leg).
    const liveTrades = collapseRetiredEntries(trades);
    const closureTrades = liveTrades.filter(t => hasClosureContext(t));
    const regularTrades = liveTrades.filter(t => !hasClosureContext(t));

    // Process closure trades - de-duplicate by symbol
    const closureBySymbol = {};
    closureTrades.forEach(trade => {
      const symbol = trade.Symbol;
      if (!closureBySymbol[symbol]) {
        closureBySymbol[symbol] = {
          ...trade,
          // Current holding is opposite of toTradeQty
          currentHolding: Math.abs(trade.toTradeQty || 0),
          // Type is determined by toTradeQty sign (negative = SELL)
          Type: (trade.toTradeQty || 0) < 0 ? 'SELL' : 'BUY',
          Quantity: Math.abs(trade.toTradeQty || trade.Quantity || 1),
        };
      }
    });

    // Process regular trades - net by symbol
    const regularBySymbol = {};
    regularTrades.forEach(trade => {
      const symbol = trade.Symbol;
      if (!regularBySymbol[symbol]) {
        regularBySymbol[symbol] = {
          ...trade,
          buyQty: 0,
          sellQty: 0,
        };
      }

      const qty = trade.Quantity || 1;
      if (trade.Type === 'BUY') {
        regularBySymbol[symbol].buyQty += qty;
      } else if (trade.Type === 'SELL') {
        regularBySymbol[symbol].sellQty += qty;
      }
    });

    // Calculate net positions for regular trades
    const nettedRegular = Object.values(regularBySymbol).map(trade => {
      const netQty = trade.buyQty - trade.sellQty;
      if (netQty === 0) return null; // Fully cancelled out

      return {
        ...trade,
        Type: netQty > 0 ? 'BUY' : 'SELL',
        Quantity: Math.abs(netQty),
        netQuantity: netQty,
      };
    }).filter(Boolean);

    // Combine closure and netted regular trades
    return [
      ...Object.values(closureBySymbol),
      ...nettedRegular,
    ];
  };

  /**
   * Check if a basket has been edited (lastUpdated != date)
   */
  const isBasketEdited = (basket) => {
    if (!basket.lastUpdated || !basket.date) return false;
    const dateVal = new Date(basket.date).getTime();
    const lastUpdatedVal = new Date(basket.lastUpdated).getTime();
    // Consider edited if difference is more than 1 minute
    return Math.abs(lastUpdatedVal - dateVal) > 60000;
  };

  /**
   * Check if any trade in basket is expired
   */
  const isBasketExpired = (trades) => {
    if (!trades || trades.length === 0) return false;
    return trades.some(trade => {
      if (trade.Exchange !== 'NFO' && trade.Exchange !== 'BFO') return false;
      return !isValidSymbolExpiry(trade.Symbol, trade.Exchange);
    });
  };

  const getModelPortfolioStrategyDetails = async (options = {}) => {
    // `silent` — periodic background refresh (usePeriodicRefresh, web F-10
    // parity). Silent refetches skip the loading flag so the 30s poll never
    // flickers the MP skeleton.
    const silent = options?.silent === true;
    // Firebase preserves the case of Apple's identityToken email (Google
    // always issues lowercase). Lowercase once at the source.
    const userEmail = await getAccountEmailAsync();
    const tenantSubdomain = getTenantSubdomain(configData);

    let requestEntry = null;
    try {
      if (!silent) setIsDatafetchingMP(true);
      if (userEmail && tenantSubdomain) {
        if (!modelPortfolioHasSuccessfulResponseRef.current) {
          setModelPortfolioEntitlementsLoaded(false);
          setModelPortfolioEntitlementsStatus('loading');
        }
        console.log(
          '📊 TradeContext: Getting model portfolio with config:',
          tenantSubdomain,
        );

        const requesturl = `${server.server.baseUrl}api/model-portfolio/subscribed-strategies/${userEmail}`;
        const requestKey = `${userEmail}|${tenantSubdomain}`;
        requestEntry = modelPortfolioRequestRef.current;
        if (!requestEntry || requestEntry.key !== requestKey) {
          const generation = modelPortfolioRequestGenerationRef.current + 1;
          modelPortfolioRequestGenerationRef.current = generation;
          requestEntry = {
            key: requestKey,
            generation,
            repairStarted: false,
            promise: axios.get(requesturl, {
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': tenantSubdomain,
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
              timeout: 10000,
            }),
          };
          modelPortfolioRequestRef.current = requestEntry;
        }

        const response = await requestEntry.promise;
        const subscribedPortfolios = response?.data?.subscribedPortfolios;
        if (!Array.isArray(subscribedPortfolios)) {
          throw new Error('Malformed subscribed-strategies response');
        }
        if (
          requestEntry.generation !==
          modelPortfolioRequestGenerationRef.current
        ) {
          return subscribedPortfolios;
        }

        setModelPortfolioStrategyfinal(subscribedPortfolios);
        modelPortfolioHasSuccessfulResponseRef.current = true;
        setModelPortfolioEntitlementsLoaded(true);
        setModelPortfolioEntitlementsStatus(
          subscribedPortfolios.length > 0 ? 'ready' : 'confirmedEmpty',
        );

        // Best-effort: fetch repair-trades alongside strategies so the
        // RebalanceCard can flag any partial executions. Failures here MUST
        // NOT block the strategy list — repair is a UI shortcut, not the
        // source of truth. See docs/WEB_MP_PARITY_TASKS.md § Task 4.
        // Silent strategy polling keeps the catalogue fresh but must not also
        // poll the broker every 30 seconds. Repair is loaded on the initial
        // foreground fetch, on broker change, and for the selected card when
        // the customer explicitly asks to retry.
        if (
          !options?.skipRepair &&
          (!silent || options?.refreshRepair === true) &&
          !requestEntry.repairStarted
        ) {
          requestEntry.repairStarted = true;
          await getModelPortfolioRepairTrades(
            subscribedPortfolios,
          ).catch(() => {});
        }
        return subscribedPortfolios;
      } else {
        console.warn('TradeContext: User email or tenant subdomain is not provided');
        console.log('TradeContext: userEmail:', userEmail);
        console.log('TradeContext: tenantSubdomain:', !!tenantSubdomain);
        // No request can run without both values, so resolve the readiness
        // gate instead of leaving every portfolio on "Checking status…".
        setModelPortfolioEntitlementsLoaded(true);
        if (!modelPortfolioHasSuccessfulResponseRef.current) {
          setModelPortfolioEntitlementsStatus('error');
        }
        return null;
      }
    } catch (error) {
      // A timeout, 401, or 5xx is not proof that the customer has no active
      // portfolio. Preserve the last confirmed response; only a successful
      // 200 with [] may transition Home to the catalogue state.
      setModelPortfolioEntitlementsLoaded(true);
      // 403 MF_CUSTOMER_IDENTITY_MISMATCH is not a transient failure: the
      // server proved a different customer than this request asked for, and
      // the interceptor has already replayed it once with a fresh token. A
      // "Retry" here re-issues the identical request and fails identically,
      // which is what stranded a customer on 2026-09-18. Separate it so Home
      // can offer the only action that can actually work — signing in again.
      const isIdentityMismatch =
        error?.response?.status === 403 &&
        error?.response?.data?.code === 'MF_CUSTOMER_IDENTITY_MISMATCH';
      if (!modelPortfolioHasSuccessfulResponseRef.current) {
        setModelPortfolioEntitlementsStatus(
          isIdentityMismatch ? 'identityMismatch' : 'error',
        );
      }
      if (error.response) {
        console.error(
          'TradeContext: Model Portfolio API Error:',
          error.response.status,
        );
      } else if (error.request) {
        console.error('TradeContext: Model Portfolio No response received');
      } else {
        console.error(
          'TradeContext: Model Portfolio Request Error:',
          error.message,
        );
      }
      return null;
    } finally {
      if (modelPortfolioRequestRef.current === requestEntry) {
        modelPortfolioRequestRef.current = null;
      }
      // A stale request from a previous identity must not clear the loading
      // state of the replacement request.
      if (
        !silent &&
        (!requestEntry ||
          requestEntry.generation ===
            modelPortfolioRequestGenerationRef.current)
      ) {
        setIsDatafetchingMP(false);
      }
    }
  };

  // Fetch repair-trades for the requested MP strategies. Result is stored
  // in `modelPortfolioRepairTrades`; consumers (RebalanceCard) match by
  // `modelId === rebalanceHistory[latest].model_Id`.
  //
  // Mirrors web's `getRebalanceRepair` in prod-alphaquark-github/
  // src/Home/LivePortfolioSection/Home.js:364-393.
  const getRecentRepairResult = ({modelName, broker: forBroker, maxAgeMs = 30000} = {}) => {
    const cached = lastRepairResultRef.current;
    if (!cached || Date.now() - cached.at > maxAgeMs) return null;
    const norm = value => String(value || '').trim().toLowerCase();
    if (!modelName || !cached.models.has(norm(modelName))) return null;
    if (forBroker && norm(forBroker) !== cached.broker) return null;
    return cached.result;
  };

  const getModelPortfolioRepairTrades = async (portfolios, options = {}) => {
    const auth = getAuth();
    const user = auth.currentUser;
    // Firebase preserves the case of Apple's identityToken email
  // (Google always issues lowercase). Backend GET /api/user/getUser/:email
  // auto-lowercases but backend POST /api/user/ stores VERBATIM — so every
  // downstream URL that embeds userEmail must match the lowercase record
  // we now write in completeAppleSignIn. Lowercase once at the source.
  const userEmail = await getAccountEmailAsync();
    const tenantSubdomain = getTenantSubdomain(configData);

    if (!userEmail || !tenantSubdomain) {
      return {models: [], pending: false, unknown: true};
    }
    const list = Array.isArray(portfolios)
      ? portfolios
      : portfolios
        ? [portfolios]
        : [];
    if (list.length === 0) {
      setModelPortfolioRepairTrades([]);
      return {models: [], pending: false, unknown: false};
    }

    const modelNames = [...new Set(
      list.map(p => p?.model_name).filter(Boolean),
    )];
    const advisor =
      list[0]?.advisor ||
      configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
    // Re-derive broker at call time from userDetails (the source of truth)
    // rather than the possibly-stale `broker` state. On a cold start the
    // [userEmail, configData] effect fires getModelPortfolioStrategyDetails ->
    // getModelPortfolioRepairTrades BEFORE getUserDeatils() has setBroker(),
    // so `broker` is null -> userBroker became 'DummyBroker' -> the call was
    // skipped -> no "Repair"/rejected section even though orders were
    // rejected (ajay.j.bhatia 2026-08-10, markup FlexiCap/LargeMid).
    const userBroker = broker || userDetails?.user_broker || 'DummyBroker';

    if (userBroker === 'DummyBroker') {
      // Backend returns 404 for DummyBroker; skip the call.
      setModelPortfolioRepairTrades([]);
      return {models: [], pending: false, unknown: false};
    }

    const normalizeModelName = value => String(value || '').trim().toLowerCase();
    const requestedModelNames = new Set(modelNames.map(normalizeModelName));
    const replaceRequestedRepairModels = models => {
      setModelPortfolioRepairTrades(previous => [
        ...previous.filter(
          model => !requestedModelNames.has(normalizeModelName(model?.modelName)),
        ),
        ...(Array.isArray(models) ? models : []),
      ]);
    };

    const requestKey = [
      String(userEmail).toLowerCase(),
      String(userBroker).toLowerCase(),
      ...[...modelNames].sort(),
    ].join('|');
    const activeRequest = repairRequestInFlightRef.current;
    if (activeRequest) {
      if (options.manual === true || activeRequest.requestKey !== requestKey) {
        activeRequest.controller.abort();
      } else {
        return {
          skipped: true,
          inFlight: true,
          pending: false,
          unknown: false,
          models: [],
        };
      }
    }

    const requestSequence = ++repairRequestSequenceRef.current;
    const requestEpoch = repairEpochRef.current;
    const controller = new AbortController();
    repairRequestInFlightRef.current = {
      requestKey,
      requestSequence,
      controller,
    };

    try {
      if (options.manual === true) {
        repairRetryCountRef.current = 0;
        clearTimeout(repairRetryTimerRef.current);
      }
      setIsDatafetchingRepair(true);
      setRepairReconciliation(previous => ({
        ...previous,
        checking: true,
        autoRetryScheduled: false,
      }));
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/get-repair`,
        {modelName: modelNames, advisor, userEmail, userBroker,
          refreshAccount: options.manual === true,
          // One Accept tap: lets this tap's calculate reuse the broker
          // holdings/positions read here (server keeps them <=15 s, tap-only).
          ...(options.brokerReadSession
            ? {brokerReadSession: options.brokerReadSession}
            : {})},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': tenantSubdomain,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          signal: controller.signal,
          timeout: options.manual === true ? 45000 : 10000,
        },
      );
      const repair = normalizeRepairResponse(response?.data);
      if (requestSequence !== repairRequestSequenceRef.current) {
        return {models: [], pending: false, unknown: true, superseded: true};
      }
      clearTimeout(repairRetryTimerRef.current);
      if (repair.pending || repair.unknown) {
        repairWasReconcilingRef.current = true;
        const scheduleRetry =
          options.manual !== true && repairRetryCountRef.current < 1;
        setRepairReconciliation({
          pending: repair.pending,
          unknown: repair.unknown,
          checking: false,
          autoRetryScheduled: scheduleRetry,
          retryAfterSeconds: repair.retryAfterSeconds,
          accountRecovery: repair.accountRecovery || null,
        });
        replaceRequestedRepairModels(repair.models);
        if (scheduleRetry) {
          repairRetryCountRef.current += 1;
          repairRetryTimerRef.current = setTimeout(
            () => getModelPortfolioRepairTrades(list).catch(() => {}),
            repair.retryAfterSeconds * 1000,
          );
        }
        return repair;
      }

      const resolvedAfterReconciliation = repairWasReconcilingRef.current;
      repairWasReconcilingRef.current = false;
      repairRetryCountRef.current = 0;
      setRepairReconciliation({
        pending: false,
        unknown: false,
        checking: false,
        autoRetryScheduled: false,
        retryAfterSeconds: 0,
        accountRecovery: null,
      });
      replaceRequestedRepairModels(repair.models);
      lastRepairResultRef.current =
        repair?.accountRecovery?.blocked || requestEpoch !== repairEpochRef.current
        ? null
        : {
            at: Date.now(),
            email: String(userEmail).toLowerCase(),
            broker: String(userBroker).toLowerCase(),
            models: new Set(modelNames.map(normalizeModelName)),
            result: repair,
          };
      if (resolvedAfterReconciliation) {
        getModelPortfolioStrategyDetails({
          silent: true,
          skipRepair: true,
        }).catch(() => {});
      }
      return repair;
    } catch (error) {
      if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
        return {
          cancelled: true,
          pending: false,
          unknown: false,
          models: [],
        };
      }
      if (requestSequence !== repairRequestSequenceRef.current) {
        return {
          cancelled: true,
          pending: false,
          unknown: false,
          models: [],
        };
      }
      const repairError = normalizeRepairError(error);
      if (repairError) {
        clearTimeout(repairRetryTimerRef.current);
        const scheduleRetry =
          options.manual !== true && repairRetryCountRef.current < 1;
        replaceRequestedRepairModels([]);
        setRepairReconciliation({
          pending: false,
          unknown: true,
          checking: false,
          autoRetryScheduled: scheduleRetry,
          retryAfterSeconds: repairError.retryAfterSeconds,
          accountRecovery: repairError.accountRecovery || null,
        });
        if (scheduleRetry) {
          repairRetryCountRef.current += 1;
          repairRetryTimerRef.current = setTimeout(
            () => getModelPortfolioRepairTrades(list).catch(() => {}),
            repairError.retryAfterSeconds * 1000,
          );
        }
        return {
          ...repairError,
          unavailable: true,
          message:
            error?.response?.data?.message ||
            `${userBroker} verification timed out`,
        };
      }
      // 404 = no documents needing repair → not an error
      const resolvedAfterReconciliation =
        error?.response?.status === 404 && repairWasReconcilingRef.current;
      if (error?.response?.status !== 404) {
        console.warn(
          '[TradeContext] get-repair failed:',
          error?.response?.data?.message || error.message,
        );
      }
      clearTimeout(repairRetryTimerRef.current);
      repairWasReconcilingRef.current = false;
      repairRetryCountRef.current = 0;
      setRepairReconciliation({
        pending: false,
        unknown: false,
        checking: false,
        autoRetryScheduled: false,
        retryAfterSeconds: 0,
        accountRecovery: null,
      });
      replaceRequestedRepairModels([]);
      if (resolvedAfterReconciliation) {
        getModelPortfolioStrategyDetails({
          silent: true,
          skipRepair: true,
        }).catch(() => {});
      }
      if (error?.response?.status === 404) {
        return {
          verified: true,
          notFound: true,
          pending: false,
          unknown: false,
          models: [],
        };
      }
      throw error;
    } finally {
      if (requestSequence === repairRequestSequenceRef.current) {
        repairRequestInFlightRef.current = null;
        setIsDatafetchingRepair(false);
      }
    }
  };

  useEffect(() => {
    repairRequestSequenceRef.current += 1;
    clearTimeout(repairRetryTimerRef.current);
    repairWasReconcilingRef.current = false;
    repairRetryCountRef.current = 0;
    setRepairReconciliation({
      pending: false,
      unknown: false,
      checking: false,
      autoRetryScheduled: false,
      retryAfterSeconds: 0,
      accountRecovery: null,
    });
    if (broker && modelPortfolioStrategyfinal.length > 0) {
      getModelPortfolioRepairTrades(modelPortfolioStrategyfinal).catch(() => {});
    }
    return () => {
      clearTimeout(repairRetryTimerRef.current);
      repairRequestInFlightRef.current?.controller?.abort();
      repairRequestInFlightRef.current = null;
    };
    // Intentionally broker-keyed: depending on the mutable strategy array or
    // function identity would continuously restart authoritative verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, broker]);

  // Mark a model_Id as "skip repair shortcut" — called when the user
  // explicitly accepts a fresh (non-repair) rebalance. Prevents the repair
  // pre-population from re-engaging on a subsequent click for the same card.
  const markSkipRepairForModelId = modelIdValue => {
    if (!modelIdValue) return;
    skipRepairForModelIdsRef.current[modelIdValue] = true;
  };

  // Read-only check used by RebalanceCard to decide whether to apply the
  // repair shortcut on click.
  const shouldSkipRepairForModelId = modelIdValue =>
    !!skipRepairForModelIdsRef.current[modelIdValue];

  function logStockDetailsBySymbol(symbol, stockData) {
    const matchedStocks = stockData.filter(stock => stock.Symbol === symbol);
    if (matchedStocks.length > 0) {
      console.log(
        `Found ${matchedStocks.length} stock(s) for symbol: ${symbol}`,
      );
    }
  }
// Several screens request the same account-wide feed on mount. Do the heavy
// response parse/filter pass once per in-flight refresh so a cold launch does
// not queue duplicate work ahead of taps on the JS thread.
const tradesInFlightRef = useRef(null);
const tradesRequestGenerationRef = useRef(0);
const fetchAllTrades = async (options = {}) => {
  // `silent` — used by the periodic background refresh (usePeriodicRefresh,
  // web F-10 parity). A silent refetch must not flip isDatafetching: that
  // flag gates the skeleton/empty-state and a 30s poll would flicker the
  // whole list. Only explicit user/mount-triggered fetches show loading.
  const silent = options?.silent === true;
  const requestGeneration =
    options?.requestGeneration ?? tradesRequestGenerationRef.current;
  const auth = getAuth();
  const user = auth.currentUser;
  // Firebase preserves the case of Apple's identityToken email
  // (Google always issues lowercase). Backend GET /api/user/getUser/:email
  // auto-lowercases but backend POST /api/user/ stores VERBATIM — so every
  // downstream URL that embeds userEmail must match the lowercase record
  // we now write in completeAppleSignIn. Lowercase once at the source.
  const userEmail = await getAccountEmailAsync();

  // The provider can outlive a logout/login account switch. Never let the
  // previous account's async work parse or publish into the new account.
  if (requestGeneration !== tradesRequestGenerationRef.current) return;

  if (!userEmail) {
    // TradeProvider mounts before auth resolves. The [userEmail, configData]
    // useEffect fires once as soon as both look truthy from the top-level
    // closure — occasionally BEFORE Firebase has restored the on-disk
    // session on cold start (async). Once auth restores, the useEffect
    // fires again with a valid user. Warn (not error) so we don't red-
    // banner LogBox for a transient startup state.
    console.warn('[Trade Fetch] Skipped — auth not ready yet');
    if (!silent) setIsDatafetching(false);
    return;
  }

  if (!server?.server.baseUrl) {
    console.error('[Trade Fetch] Error: Server base URL is missing');
    if (!silent) setIsDatafetching(false);
    return;
  }

  if (!configData) {
    console.warn('[Trade Fetch] Warning: Config data is not available yet');
  }

  if (!configData || !userEmail) {
    console.warn("Skipping getAllTrades until configData & userEmail are ready");
    return;
  }

  if (!silent) setIsDatafetching(true);

  const customerAuthHeaders = await getCustomerAuthHeaders();
  if (requestGeneration !== tradesRequestGenerationRef.current) return;
  if (!customerAuthHeaders) {
    setstockRecoNotExecutedfinal([]);
    setrecommendationStockfinal([]);
    setrejectedTrades([]);
    setIgnoredTrades([]);
    if (!silent) setIsDatafetching(false);
    return;
  }

  // Bound the server response before it reaches the React Native bridge. The
  // backend deliberately keeps older executed/open positions in this response,
  // so this reduces historical recommendation bulk without hiding live state.
  const recommendationHistoryDays = Number.isFinite(Number(adviceShowDays))
    ? Math.min(365, Math.max(1, Math.trunc(Number(adviceShowDays))))
    : 15;
  const requestUrl = `${server.server.baseUrl}api/user/trade-reco-for-user?user_email=${encodeURIComponent(userEmail)}&days=${recommendationHistoryDays}`;

  try {
    console.log(
      '📊 TradeContext: Getting trades with config:',
      configData?.config?.REACT_APP_HEADER_NAME,
    );

    const response = await axios.get(requestUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...customerAuthHeaders,
        'X-Advisor-Subdomain': getTenantSubdomain(configData),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    });

    if (requestGeneration !== tradesRequestGenerationRef.current) return;

    const trades = response.data?.trades || [];

    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - showAdviceStatusDays);

    const flattenResponse = response => {
      const rawTrades = response?.data?.trades ?? [];

      // Collect all symbols that are legs of any basket — prevents duplicate
      // standalone cards when the same symbol appears both as a basket leg
      // and as a separate recommendation.
      const basketLegSymbols = new Set();
      rawTrades.forEach(item => {
        if (item?.basket_advice && item.basket_advice.length > 0) {
          item.basket_advice.forEach(advice => {
            if (advice.Symbol) basketLegSymbols.add(advice.Symbol);
          });
        }
      });

      return rawTrades.flatMap(item => {
        // BASKET STRUCTURE: Has basket_advice array with trades
        if (item?.basket_advice && item?.basket_advice.length > 0) {
          const tradeDate = item.date?.$date
            ? new Date(item.date.$date)
            : new Date(item.date);
          const lifecycleStatus = item?.basketLifecycle?.displayStatus;
          const managerClosed =
            lifecycleStatus === 'CLOSED' &&
            item?.basketLifecycle?.reason === 'MANAGER_CLOSED_ZERO_FILL';
          const terminalClosed = lifecycleStatus === 'CLOSED';
          const remainsCustomerVisible =
            lifecycleStatus === 'POSITION_OPEN' ||
            lifecycleStatus === 'CLOSURE_PENDING';


          // Check date on the parent basket. A closed basket stays
          // visible until the LATER of entry + advice window and closure +
          // terminalClosedExtraDays (lifecycle closedAt = latest closure-leg
          // date) so the terminal "Closed by manager" record never silently
          // vanishes.
          if (terminalClosed) {
            const closedAt = item?.basketLifecycle?.closedAt
              ? new Date(item.basketLifecycle.closedAt).getTime()
              : tradeDate.getTime();
            const entryCutoff = new Date(cutoffDate.getTime());
            const closureCutoff = new Date(
              closedAt + terminalClosedExtraDays * 24 * 60 * 60 * 1000
            );
            const effectiveCutoff = closureCutoff > entryCutoff
              ? closureCutoff
              : entryCutoff;
            if (new Date() > effectiveCutoff && !remainsCustomerVisible) {
              return [];
            }
          } else if (tradeDate < cutoffDate && !remainsCustomerVisible) {
            return [];
          }


          // Filter basket advice for expiry validation
          const validExpiryAdvice = item.basket_advice.filter(advice => {
            const isValid = isValidSymbolExpiry(advice?.Symbol, advice?.Exchange);
            return isValid;
          });

          debugBasketProcessing(validExpiryAdvice, item.basketName);

          // Completed BUY/SELL pairs are the evidence for the Closed card.
          // Keep every valid leg: the server lifecycle owns position state,
          // and completed opposite sides can also have unequal filled sizes.
          const validBasketAdvice = validExpiryAdvice;


          if (validBasketAdvice.length === 0) {
            return [];
          }

          // Map all valid basket advice trades with closure enrichment
          const mappedTrades = validBasketAdvice.map(advice => {
            const matchedToTrade = item?.to_trade_net?.find(
              t => t.Symbol === advice.Symbol,
            );

            // Determine if this is a closure position
            const isClosure = matchedToTrade?.closure === true;
            const toTradeQty = matchedToTrade?.toTradeQty ?? 0;

            // For closure positions, calculate current holding (opposite of toTradeQty)
            const currentHolding = isClosure ? Math.abs(toTradeQty) : 0;

            return {
              ...advice,
              basketId: item.basketId,
              basketName: item.basketName,
              advisor_name: item.advisor_name,
              date: item.date,
              lastUpdated: item.lastUpdated,
              description: item.description,
              basketLifecycle: item.basketLifecycle,
              basketSchemaVersion: item.basketSchemaVersion,
              recommendationIntent: item.recommendationIntent,
              entryBlockedAt: item.entryBlockedAt,
              entryBlockedReason: item.entryBlockedReason,
              entryGate: item.entryGate,
              entryNarrative: item.entryNarrative,
              exitNarrative: item.exitNarrative,
              toTradeQty: toTradeQty,
              // Closure-specific fields
              isClosure: isClosure,
              currentHolding: currentHolding,
              closurestatus: advice.closurestatus || null,
              // Two SEPARATE cancel flags, mirroring web
              // StockRecommendation.js flatten (2026-05-17 split):
              //   cancel — leg-level only (advisor cancel-leg on this row)
              //   basketCancelled — parent doc-level (basket Reject / admin
              //                      cancelled the whole basket)
              // The customer Reject flow sets cancel=true on the PARENT
              // tradereco row only, so legs carry basketCancelled. The
              // BasketCard + groupTrades consumers read both.
              cancel: advice.cancel === true,
              basketCancelled: item.cancel === true || item.basketCancelled === true,
              // For basket metadata
              isEdited: isBasketEdited(item),
            };
          });

          return mappedTrades;
        }

        // REGULAR TRADES: Not a basket
        // Exclude if this symbol is already a leg of a basket (prevents duplicate cards)
        if (basketLegSymbols.has(item?.Symbol)) return [];
        if (!isValidSymbolExpiry(item?.Symbol, item?.Exchange)) {
          return [];
        }
        return [item];
      });
    };

    const flattenedTrades = flattenResponse(response);

    const validTrades = flattenedTrades.filter(trade => {
      return isValidSymbolExpiry(trade?.Symbol, trade?.Exchange);
    });

    // A broadcast close may legitimately arrive with Quantity=0/blank, so it
    // must remain visible. Two narrower rules prevent that safety behaviour
    // from resurrecting stale cards: show only the newest pending full-close
    // for a symbol, and hide it once a positive-quantity full-close execution
    // has already flattened the latest advised position.
    const lifecycleTime = trade =>
      new Date(
        trade?.exitDate ||
          trade?.purchaseDate ||
          trade?.updatedAt ||
          trade?.createdAt ||
          trade?.date ||
          0,
      ).getTime() || 0;
    const symbolKey = trade => String(trade?.Symbol || '').trim().toUpperCase();
    const effectiveExecutedQty = trade =>
      Math.max(
        0,
        Number(trade?.tradedQty || 0),
        Number(trade?.filledQty || 0),
        Number(trade?.executedQty || 0),
        Number(trade?.Quantity || 0),
      );
    const completedStatuses = new Set([
      'complete',
      'completed',
      'executed',
      'success',
      'filled',
      'manually_placed',
    ]);
    const isFullExit = trade =>
      String(trade?.Type || '').toUpperCase() === 'SELL' &&
      (String(trade?.closurestatus || '').toLowerCase() === 'fullclose' ||
        String(trade?.purpose || '').toUpperCase() === 'EXIT');
    const isPendingFullExit = trade =>
      isFullExit(trade) &&
      String(trade?.trade_place_status || '').toLowerCase() === 'recommend';
    const latestPendingExit = new Map();
    const latestCompletedExitAt = new Map();
    const latestCompletedEntryAt = new Map();
    validTrades.forEach(trade => {
      if (trade?.basketId || trade?.basket_advice) return;
      const key = symbolKey(trade);
      if (!key) return;
      const at = lifecycleTime(trade);
      if (isPendingFullExit(trade)) {
        const current = latestPendingExit.get(key);
        if (!current || at >= lifecycleTime(current)) latestPendingExit.set(key, trade);
      }
      const status = String(trade?.trade_place_status || '').toLowerCase();
      if (!completedStatuses.has(status) || effectiveExecutedQty(trade) <= 0) return;
      if (isFullExit(trade)) {
        latestCompletedExitAt.set(key, Math.max(latestCompletedExitAt.get(key) || 0, at));
      } else if (String(trade?.Type || '').toUpperCase() === 'BUY') {
        latestCompletedEntryAt.set(key, Math.max(latestCompletedEntryAt.get(key) || 0, at));
      }
    });

    const isRejectedStatus = (status) => isOrderRejected(status);

    const processedTrades = validTrades?.reduce(
      (acc, trade) => {
        const tradeDate = new Date(trade?.date);

        // A manager full-close paired with an unfilled single-stock entry is a
        // withdrawal, not an actionable sell. Keep basket lifecycle handling
        // below separate because it is based on broker net positions.
        if (isWithdrawnUnfilledEntry(trade, validTrades)) return acc;

        if (isPendingFullExit(trade) && !trade?.basketId) {
          const key = symbolKey(trade);
          if (latestPendingExit.get(key) !== trade) return acc;
          const completedExitAt = latestCompletedExitAt.get(key) || 0;
          const completedEntryAt = latestCompletedEntryAt.get(key) || 0;
          if (completedExitAt > 0 && completedExitAt >= completedEntryAt) return acc;
        }

        // BASKET TRADES: Have basketId and toTradeQty property
        if (trade.basketId && trade.hasOwnProperty('toTradeQty')) {
          // B-32 / B-36 / B-37 / B-27 (2026-05-19 mobile migration):
          // Pre-fix this branch ONLY accepted status="recommend" — silently
          // dropping partial / complete / rejected basket legs entirely
          // from the customer's view. That broke the partial-fill recovery
          // flow (B-10 retry can't fire on a leg the customer can't see)
          // AND the "X already executed / Y previously rejected" banner
          // (counts came from these legs).
          //
          // Now we admit every non-cancelled basket leg that's date-current.
          // The downstream netBasketTrades + BasketTradeModal's actionable
          // filter handle the render-table split (partial/recommend/rejected
          // shown as actionable; complete shown in banner only).
          const lifecycleStatus = trade?.basketLifecycle?.displayStatus;
          const terminalClosed = lifecycleStatus === 'CLOSED';
          const remainsCustomerVisible =
            lifecycleStatus === 'POSITION_OPEN' ||
            lifecycleStatus === 'CLOSURE_PENDING';
          // A manager-closed zero-fill basket (auto-cancel zero-fill closure:
          // every leg cancelled, no fills) must stay visible as its terminal
          // "Closed by manager" card instead of vanishing. The auto-cancel
          // stamps `cancel: true` on the legs, so the customer-Reject drop
          // below must not fire for it — the Reject drop exists for a
          // customer's own "I don't want this trade" intent, which the
          // backend marks via the PARENT row (basketCancelled), not for
          // leg-level auto-cancels.
          const managerClosed =
            lifecycleStatus === 'CLOSED' &&
            trade?.basketLifecycle?.reason === 'MANAGER_CLOSED_ZERO_FILL';
          // Closed records stay visible until the LATER of entry +
          // advice window and closure + terminalClosedExtraDays (lifecycle
          // closedAt = latest closure-leg date) so the terminal card never
          // silently vanishes.
          if (terminalClosed) {
            const closedAt = trade?.basketLifecycle?.closedAt
              ? new Date(trade.basketLifecycle.closedAt).getTime()
              : tradeDate.getTime();
            const entryCutoff = new Date(cutoffDate.getTime());
            const closureCutoff = new Date(
              closedAt + terminalClosedExtraDays * 24 * 60 * 60 * 1000
            );
            const effectiveCutoff = closureCutoff > entryCutoff
              ? closureCutoff
              : entryCutoff;
            if (new Date() > effectiveCutoff && !remainsCustomerVisible) return acc;
          } else if (tradeDate < cutoffDate && !remainsCustomerVisible) return acc;
          // AlphaB2B groups lifecycle-aware closed cards from this same feed.
          if (terminalClosed) {
            acc.recommended.push(trade);
            return acc;
          }
          // A customer Reject sets cancel=true on the PARENT tradereco row;
          // the flatten surfaces it as basketCancelled on every leg. The
          // customer's intent is "I don't want this trade" — drop the whole
          // basket from the feed immediately after the first successful
          // refetch, instead of leaving it visible (backend keeps returning
          // the row until its customer_visible_until cutoff).
          if (!managerClosed && (trade?.cancel === true || trade?.basketCancelled === true)) return acc;
          const status = (trade?.trade_place_status || '').toLowerCase();
          if (managerClosed || isBasketCustomerVisibleStatus(status)) {
            acc.recommended.push(trade);
          }
          return acc;
        }

        // REGULAR TRADES: Process normally
        // Closed/withdrawn single-stock rows (advisor-cancelled or
        // manager-closed) stay visible until the LATER of entry + advice
        // window and closure + terminalClosedExtraDays (exit/purchase date,
        // else advice date).
        const stockStatus = String(trade?.trade_place_status || '').toLowerCase();
        const stockClosureStatus = String(trade?.closurestatus || '').toLowerCase();
        // `fullClose` describes the advisor's intent as well as the eventual
        // terminal outcome. A fresh SELL row is still an ACTION even when its
        // broadcast quantity is blank/zero; the customer must see it and
        // verify quantity before placement. Only terminal status/cancel
        // evidence may move that row out of Current Recommendations.
        const isPendingSingleStockExit =
          stockStatus === 'recommend' &&
          String(trade?.Type || '').toUpperCase() === 'SELL' &&
          (['fullclose', 'partialclose'].includes(stockClosureStatus) ||
            String(trade?.purpose || '').toUpperCase() === 'EXIT');
        const isTerminalSingleStock =
          trade?.cancel === true ||
          ['cancelled', 'canceled', 'closed'].includes(stockStatus) ||
          (!isPendingSingleStockExit &&
            ['fullclose', 'closed'].includes(stockClosureStatus));
        const stockWithinWindow = isTerminalSingleStock
          ? (() => {
              const closureAnchor =
                trade?.exitDate || trade?.purchaseDate || trade?.date || cutoffDate;
              const entryCutoff = new Date(cutoffDate.getTime());
              const closureCutoff = new Date(
                new Date(closureAnchor).getTime() +
                  terminalClosedExtraDays * 24 * 60 * 60 * 1000
              );
              const effectiveCutoff = closureCutoff > entryCutoff
                ? closureCutoff
                : entryCutoff;
              return new Date() <= effectiveCutoff;
            })()
          : tradeDate >= cutoffDate;

        // Terminal records must never fall through to the active
        // recommendation checks. Legacy full-close rows can retain
        // trade_place_status="recommend", which otherwise resurrects a
        // Closed card on Home.
        if (isTerminalSingleStock) {
          return acc;
        }

        // REJECTED
        if (
          isRejectedStatus(trade?.trade_place_status) &&
          trade?.Basket === undefined &&
          (trade?.rebalance_status === undefined ||
            trade?.rebalance_status === null) &&
          !trade?.model_id &&
          stockWithinWindow
        ) {
          acc.rejected.push(trade);
        }

        // OPEN POSITIONS — an executed single-stock BUY the backend resolved
        // to positionStatus "Open" (2026-08-25 web parity). Admitted read-only
        // so a held position stays visible with its SL/PT until the advisor
        // closes it. Exempt from the advice date window: a position is
        // visible for as long as it is held.
        const executedSingleStatus = ['complete', 'executed', 'success', 'filled'].includes(stockStatus);
        const isOpenPosition =
          executedSingleStatus &&
          String(trade?.positionStatus || '').toLowerCase() === 'open' &&
          String(trade?.Type || '').toUpperCase() === 'BUY' &&
          trade?.cancel !== true &&
          trade?.basketCancelled !== true &&
          trade?.Basket === undefined;
        if (isOpenPosition) {
          acc.recommended.push({...trade, isOpenPosition: true});
          return acc;
        }

        // RECOMMENDED — only active recommendations; rejected bespoke lives
        // exclusively in acc.rejected and is surfaced via the Rejected tab.
        if (
          trade?.trade_place_status === 'recommend' &&
          stockWithinWindow
        ) {
          acc.recommended.push(trade);
        }

        // IGNORED
        if (trade.trade_place_status === 'ignored' && tradeDate >= cutoffDate) {
          acc.ignored.push(trade);
        }

        return acc;
      },
      {recommended: [], rejected: [], ignored: []},
    );

    // Sort recommended by LATEST ACTIVITY, descending: for a basket leg the
    // activity is the lifecycle closedAt (exit datetime) when present, else
    // the leg's own exit/purchase/advice date. A basket whose exit happened
    // on 20 Aug must sort above one advised on 13 Aug — container `date` is
    // the advice date and would misorder. The downstream basket grouping
    // preserves first-encounter order, so the latest-activity basket lands
    // first; stocks sort by their own date.
    const activityTimestamp = (t) => {
      if (t?.basketLifecycle?.closedAt) {
        return new Date(t.basketLifecycle.closedAt).getTime();
      }
      return new Date(
        t?.exitDate || t?.purchaseDate || t?.date || 0
      ).getTime();
    };
    processedTrades.recommended.sort(
      (a, b) => activityTimestamp(b) - activityTimestamp(a),
    );

    setrejectedTrades(processedTrades.rejected);
    setIgnoredTrades(processedTrades.ignored);
    setstockRecoNotExecutedfinal(processedTrades.recommended);
    setrecommendationStockfinal(processedTrades.recommended);

    if (trades.length === 0 && !hasFetchedTrades) {
      await handleNoTrades(userEmail, trades);
    }
  } catch (error) {
    console.error('[Trade Fetch] Error:', error);
  } finally {
    if (!silent && requestGeneration === tradesRequestGenerationRef.current) {
      setIsDatafetching(false);
    }
  }
};
const getAllTrades = (options = {}) => {
  // Do not ever reuse another account/tenant's in-flight response when the
  // provider survives an identity or advisor switch.
  const requestKey = `${userEmail || ''}:${configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || ''}:${adviceShowDays}`;
  if (tradesInFlightRef.current?.key === requestKey) {
    return tradesInFlightRef.current.promise;
  }
  const requestGeneration = ++tradesRequestGenerationRef.current;
  const request = fetchAllTrades({...options, requestGeneration});
  tradesInFlightRef.current = {key: requestKey, promise: request};
  const clear = () => {
    if (tradesInFlightRef.current?.promise === request) tradesInFlightRef.current = null;
  };
  request.then(clear, clear);
  return request;
};
  const [hasFetchedTrades, setHasFetchedTrades] = useState(false);
  const [planList, setPlanList] = useState(null);
  const hasFetchedTradesRef = useRef(false);

  const handleNoTrades = async (userEmail, trades) => {
    try {
      const response = await axios({
        method: 'get',
        url: `${server.server.baseUrl}api/sendnotification/${userEmail}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      });

      setPlanList(response?.data?.isValid);

      // DISABLED: Don't send recommendations to users without active plans
      // Previously, we were sending last 2 recommendations even to non-subscribed users
      // This has been removed to ensure only paying subscribers receive trade recommendations

      // if (response?.data?.isValid === false) {
      //   const sendRecoUrl = `${server.ccxtServer.baseUrl}comms/send-last-reco/2`;
      //   const payload = {
      //     userEmail: userEmail,
      //     advisorName: advisorspecific,
      //   };

      //   await axios.post(sendRecoUrl, payload, {
      //     headers: {
      //       'Content-Type': 'application/json',
      //       'X-Advisor-Subdomain': getTenantSubdomain(),
      //       'aq-encrypted-key': generateToken(
      //         Config.REACT_APP_AQ_KEYS,
      //         Config.REACT_APP_AQ_SECRET,
      //       ),
      //     },
      //   });

      //   setTimeout(() => {
      //     if (!hasFetchedTradesRef.current) {
      //       console.log('Calling getAllTrades only once...');
      //       hasFetchedTradesRef.current = true;
      //       getAllTrades();
      //     }
      //   }, 1000);
      // }
      return response?.data?.isValid;
    } catch (planError) {
      if (planError.response) {
        if (
          planError.response.data.status === 1 &&
          planError.response.data.plans.length === 0
        ) {
          setPlanList(false);
        }
      } else if (planError.request) {
        console.error('No response received:', planError.request);
      } else {
        console.error('Error fetching plan list:', planError.message);
      }
    }
  };

  const getPlanList = async () => {
    // Re-derive at call time — see comment in getUserDeatils. This was
    // using the stale top-level closure and hitting
    // /api/sendnotification/undefined on fresh Apple sign-ins, which is
    // exactly why the Plans / Model Portfolio catalog rendered empty
    // after Apple login even though the same account showed plans fine
    // after a subsequent Google login (Firebase cached currentUser
    // populates the closure early enough for Google flows).
    const authNow = getAuth();
    const currentUser = authNow.currentUser;
    const userEmail = await getAccountEmailAsync();
    if (!userEmail) {
      console.warn('[getPlanList] skipped — auth not ready yet');
      return;
    }
    try {
      const response = await axios({
        method: 'get',
        url: `${server.server.baseUrl}api/sendnotification/${userEmail}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      });
      setPlanList(response?.data?.isValid);
      return response?.data?.isValid;
    } catch (planError) {
      if (planError.response) {
        console.error('API Error Response:', planError.response.data);
        if (
          planError.response.data.status === 1 &&
          planError.response.data.plans.length === 0
        ) {
          setPlanList(false);
        }
      } else if (planError.request) {
        console.error('No response received:', planError.request);
      } else {
        console.error('Error fetching plan list:', planError.message);
      }
    }
  };

  // ... (keeping all your other existing functions as they were)
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [userDetails, setUserDetails] = useState(null);
  const [brokerStatus, setBrokerStatus] = useState(null);
  const [funds, setFunds] = useState({});
  // Keep presentation state separate from the latest broker probe. A failed
  // probe must remain visible to execution safety checks through `funds`, but
  // it must never turn a previously verified balance into an invented zero.
  const [confirmedFunds, setConfirmedFunds] = useState(null);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [fundsError, setFundsError] = useState(null);
  const userDetailsInFlightRef = useRef(null);
  const fundsRequestSequenceRef = useRef(0);
  const fundsInFlightRef = useRef(null);
  const confirmedFundsRef = useRef(null);
  // Wall-clock of the most recent order-placement round-trip. Any cash
  // snapshot verified BEFORE this moment predates the order and must not be
  // served from the `maxAgeMs` cache — see `getAllFunds` and the axios
  // interceptor below.
  const lastOrderPlacedAtRef = useRef(0);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationBroker, setMigrationBroker] = useState(null);

  // Broker Order Book State for reconciliation
  const [brokerOrders, setBrokerOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [isOrderBookLoading, setIsOrderBookLoading] = useState(false);
  const [lastOrderBookRefresh, setLastOrderBookRefresh] = useState(null);
  const [orderBookError, setOrderBookError] = useState(null);
  const autoRefreshTimerRef = useRef(null);

  // TradeProvider remains mounted across some identity transitions. Clear the
  // previous account's recommendation working set synchronously at that
  // boundary and invalidate every older response. Device credential vaults
  // are intentionally untouched: they are separately encrypted and scoped by
  // advisor, broker and email.
  useEffect(() => {
    tradesRequestGenerationRef.current += 1;
    tradesInFlightRef.current = null;
    setstockRecoNotExecutedfinal([]);
    setrecommendationStockfinal([]);
    setrejectedTrades([]);
    setIgnoredTrades([]);
    setHasFetchedTrades(false);
    hasFetchedTradesRef.current = false;
    setPlanList(null);
  }, [userEmail, configData?.config?.REACT_APP_HEADER_NAME]);

  /**
   * Fetch broker order book for reconciliation and status refresh
   * @param {boolean} forceRefresh - Force a fresh fetch even if recently fetched
   * @returns {Promise<object>} - { orders, pendingOrders, error }
   */
  const fetchBrokerOrderBook = useCallback(async (forceRefresh = false) => {
    // Check if user details are available
    if (!userDetails || !userDetails.user_broker) {
      console.log('[TradeContext] No broker connected, skipping order book fetch');
      return { orders: [], pendingOrders: [], error: 'No broker connected' };
    }

    // Skip if recently fetched (within 10 seconds) unless force refresh
    if (!forceRefresh && lastOrderBookRefresh) {
      const timeSinceLastRefresh = Date.now() - lastOrderBookRefresh.getTime();
      if (timeSinceLastRefresh < 10000) {
        console.log('[TradeContext] Using cached order book data');
        return { orders: brokerOrders, pendingOrders, error: null };
      }
    }

    setIsOrderBookLoading(true);
    setOrderBookError(null);

    try {
      const credentials = {
        clientCode: userDetails.clientCode,
        apiKey: userDetails.apiKey,
        jwtToken: userDetails.jwtToken,
        secretKey: userDetails.secretKey,
        sid: userDetails.sid,
        viewToken: userDetails.viewToken,
        serverId: userDetails.serverId,
      };

      console.log('[TradeContext] Fetching order book for:', userDetails.user_broker);
      const orders = await fetchOrderBook(userDetails.user_broker, credentials, configData);

      // Filter pending orders
      const pending = orders.filter(order => order.normalizedStatus === 'pending');

      setBrokerOrders(orders);
      setPendingOrders(pending);
      setLastOrderBookRefresh(new Date());
      setOrderBookError(null);

      console.log(`[TradeContext] Order book fetched: ${orders.length} total, ${pending.length} pending`);

      return { orders, pendingOrders: pending, error: null };
    } catch (error) {
      console.error('[TradeContext] Error fetching order book:', error.message);
      setOrderBookError(error.message);
      return { orders: brokerOrders, pendingOrders, error: error.message };
    } finally {
      setIsOrderBookLoading(false);
    }
  }, [userDetails, brokerOrders, pendingOrders, lastOrderBookRefresh, configData]);

  /**
   * Get pending orders for a specific symbol
   * @param {string} symbol - Trading symbol
   * @param {string} transactionType - Optional: BUY or SELL
   * @returns {Array} - Matching pending orders
   */
  const getPendingOrdersForSymbol = useCallback((symbol, transactionType = null) => {
    return pendingOrders.filter(order => {
      const symbolMatch = order.symbol?.toUpperCase() === symbol?.toUpperCase();
      const typeMatch = transactionType
        ? order.transactionType?.toUpperCase() === transactionType.toUpperCase()
        : true;
      return symbolMatch && typeMatch;
    });
  }, [pendingOrders]);

  /**
   * Start auto-refresh timer for pending orders (30 seconds)
   */
  const startAutoRefresh = useCallback(() => {
    // Clear any existing timer
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    // Only start if there are pending orders
    if (pendingOrders.length > 0) {
      console.log('[TradeContext] Starting auto-refresh for pending orders');
      autoRefreshTimerRef.current = setInterval(() => {
        fetchBrokerOrderBook(true);
      }, 30000); // 30 seconds
    }
  }, [pendingOrders, fetchBrokerOrderBook]);

  /**
   * Stop auto-refresh timer
   */
  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
      console.log('[TradeContext] Stopped auto-refresh for pending orders');
    }
  }, []);

  const fetchUserDetailsRequest = async (userEmail, attempt = 0) => {
    // The email is resolved by getUserDeatils at call time because the
    // provider can mount before Firebase/Apple identity hydration finishes.
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      const user = response.data.User;

      setBroker(user?.user_broker);
      setUserDetails(user);
      setIsBrokerConnected(!!user?.user_broker);
      if (user?.user_broker && user?.jwtToken) {
        saveBrokerSessionTime(user.user_broker);
      }
      if (
        response?.data?.phone_number &&
        response?.data?.phone_number.toString().length >= 9
      ) {
        setIsProfileCompleted(true);
      }
      setBrokerStatus(user?.connect_broker_status);
      return user;
    } catch (error) {
      // 404 on first-time Apple sign-in: TradeProvider's [userEmail,
      // configData] useEffect can fire the moment onAuthStateChanged
      // propagates, which may race ahead of LoginScreen's completeAppleSignIn
      // POST that actually creates the Mongo record. Retry a few times so a
      // fresh Apple signup doesn't strand the user on an empty Home.
      const status = error?.response?.status;
      if (status === 404 && attempt < 3) {
        const delayMs = 1500 * (attempt + 1);
        console.warn(
          `[getUserDeatils] 404 on attempt ${attempt + 1} — retrying in ${delayMs}ms`,
        );
        await new Promise(r => setTimeout(r, delayMs));
        return fetchUserDetailsRequest(userEmail, attempt + 1);
      }
      console.error('Error fetching user details:', error.message);
    }
  };

  const getUserDeatils = async () => {
    // App launch, mounted screens and broker reconnect events frequently ask
    // for the same user document in the same frame. Joining that request
    // avoids repeated JSON parsing and global context updates that can starve
    // bottom-tab presses for several seconds on lower-end Android devices.
    const requestEmail = await getAccountEmailAsync();
    if (!requestEmail) {
      console.warn('[getUserDeatils] skipped — no authenticated user yet');
      return;
    }
    const requestKey = `${requestEmail}:${getTenantSubdomain(configData)}`;
    if (userDetailsInFlightRef.current?.requestKey === requestKey) {
      return userDetailsInFlightRef.current.promise;
    }

    const promise = fetchUserDetailsRequest(requestEmail);
    userDetailsInFlightRef.current = {requestKey, promise};
    try {
      return await promise;
    } finally {
      if (userDetailsInFlightRef.current?.promise === promise) {
        userDetailsInFlightRef.current = null;
      }
    }
  };

  const [broker, setBroker] = useState(
    userDetails ? userDetails?.user_broker : null,
  );

  const getAllFunds = async (options = {}) => {
    const force = options?.force === true;
    const maxAgeMs = Number(options?.maxAgeMs) || 0;
    const details = options?.userDetailsOverride || userDetails;
    if (!details) {
      return null;
    }
    const targetBroker = details.user_broker || broker;
    if (
      targetBroker === null ||
      targetBroker === undefined ||
      targetBroker === ''
    ) {
      setBrokerHoldingsData([]);
      return null;
    }

    const {
      clientCode,
      apiKey,
      jwtToken,
      secretKey,
      sid,
      serverId,
    } = details;

    const userEmail = await getAccountEmailAsync();
    const requestKey = `${userEmail || ''}:${targetBroker}`;
    // A reconnect can replace the broker token while an older funds request
    // for the same user+broker is still in flight.  Do not join that request:
    // its expired-token response would otherwise win the post-login refresh
    // and immediately reopen "Authentication Required" behind the success
    // alert.  Keep the display/cache key account-scoped, but make the
    // single-flight identity credential-scoped.  This value stays in memory
    // only and is never logged or persisted.
    const credentialsKey = [
      clientCode,
      apiKey,
      jwtToken,
      secretKey,
      sid,
      serverId,
    ]
      .map(value => String(value ?? ''))
      .join('\u001f');

    const cached = confirmedFundsRef.current;
    if (
      !force &&
      maxAgeMs > 0 &&
      cached?.requestKey === requestKey &&
      Date.now() - cached.verifiedAt < maxAgeMs &&
      // An order placed after this snapshot was taken has changed buying
      // power. Serving the cached value here is what made the broker screen
      // show pre-order cash for up to `maxAgeMs` after an execution
      // (user-reported on ICICI Direct, 2026-09-02).
      cached.verifiedAt > lastOrderPlacedAtRef.current
    ) {
      return cached.funds;
    }

    // Screen focus, reconnect events and navigation can request funds at the
    // same time. Join the existing call rather than increasing broker load.
    if (
      fundsInFlightRef.current?.requestKey === requestKey &&
      fundsInFlightRef.current?.credentialsKey === credentialsKey
    ) {
      return fundsInFlightRef.current.promise;
    }

    const requestSequence = ++fundsRequestSequenceRef.current;
    setFundsLoading(true);
    setFundsError(null);
    const promise = (async () => {
      try {
        const fetchedFunds = await fetchFunds(
          targetBroker,
          clientCode,
          apiKey,
          jwtToken,
          secretKey,
          sid,
          serverId,
          userEmail,
        );
        if (requestSequence !== fundsRequestSequenceRef.current) {
          return fetchedFunds;
        }

        // `funds` intentionally receives broker errors for execution/session
        // classification. Only a response containing a real numeric cash
        // value is allowed into the display snapshot.
        if (fetchedFunds) setFunds(fetchedFunds);
        const snapshot = confirmedFundsSnapshot(fetchedFunds);
        if (snapshot) {
          const verified = {...snapshot, requestKey};
          confirmedFundsRef.current = verified;
          setConfirmedFunds(verified);
          setFundsError(null);
        } else {
          setFundsError(
            fetchedFunds?.message || 'Balance is temporarily unavailable',
          );
        }
        return fetchedFunds || null;
      } catch (error) {
        if (requestSequence === fundsRequestSequenceRef.current) {
          setFundsError(error?.message || 'Balance is temporarily unavailable');
        }
        return null;
      } finally {
        if (requestSequence === fundsRequestSequenceRef.current) {
          setFundsLoading(false);
        }
      }
    })();
    fundsInFlightRef.current = {requestKey, credentialsKey, promise};
    promise.finally(() => {
      if (fundsInFlightRef.current?.promise === promise) {
        fundsInFlightRef.current = null;
      }
    });
    return promise;
  };

  const fetchBrokerStatusModal = async (opts = {}) => {
    // `silent: true` skips the post-fetch migration-modal trigger.
    // Used by the app-start refresh (line ~1302) where popping
    // "Reconnected to {broker}" is misleading — the broker may not
    // actually be connected, may need re-auth, and the user did not
    // just reconnect. Migration modal should only fire after an
    // explicit reconnect action by the user. User-reported 2026-04-29.
    const silent = opts.silent === true;
    const refreshFunds = opts.refreshFunds !== false;
    // Re-derive at call time — see comment in getUserDeatils.
    const userEmail = await getAccountEmailAsync();
    if (!userEmail) return;
    try {
      const updatedUser = await getUserDeatils();
      let refreshedFunds = null;
      // After a reconnect we must refresh funds immediately. Relying on
      // the [userDetails, configData] useEffect alone is flaky: it gates
      // on the stale `broker` state (so a reconnect into the same broker
      // can still see the old `funds` object) and `getAllFunds` closes
      // over a userDetails snapshot that may not be committed yet.
      // `handleCheckStatus` / `isFundsErrorOrMissing` in RebalanceCard
      // then reads stale funds and re-pops the TokenExpire modal — the
      // "Login to {broker} loops forever after successful reconnect"
      // bug. Run the single-flight funds loader with the fresh user object.
      if (updatedUser?.user_broker && refreshFunds) {
        try {
          refreshedFunds = await getAllFunds({
            force: true,
            userDetailsOverride: updatedUser,
          });
        } catch (fundsErr) {
          console.warn(
            '[fetchBrokerStatusModal] funds refresh failed:',
            fundsErr?.message,
          );
        }

        // Check if this broker switch requires holdings migration
        try {
          const migrationRes = await axios.get(
            `${server.server.baseUrl}api/model-portfolio-db-update/broker-migration-summary/${encodeURIComponent(userEmail)}`,
            {
              params: {newBroker: updatedUser.user_broker},
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': getTenantSubdomain(configData),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            },
          );
          if (migrationRes.data?.data?.requiresMigration && !silent) {
            setMigrationBroker(updatedUser.user_broker);
            // Delay so navigation.goBack() animation (~300ms) fully completes
            // before the bottom sheet slides up. Without this delay the sheet
            // renders mid-navigation, truncating the SubscriptionScreen's
            // "Your Broker & Funds Info" card rows (they are hidden behind the
            // white sheet). Web prod equivalent: migration check only fires
            // after user clicks "Continue" on the success dialog — the delay
            // here achieves the same settled-screen guarantee on mobile.
            setTimeout(() => setShowMigrationModal(true), 700);
            return {
              migrationWillShow: true,
              userDetails: updatedUser,
              funds: refreshedFunds,
            };
          }
          return {
            migrationWillShow: false,
            userDetails: updatedUser,
            funds: refreshedFunds,
          };
        } catch (migErr) {
          console.warn('[fetchBrokerStatusModal] migration check failed:', migErr?.message);
          return {
            migrationWillShow: false,
            userDetails: updatedUser,
            funds: refreshedFunds,
          };
        }
      }
      return {
        migrationWillShow: false,
        userDetails: updatedUser,
        funds: refreshedFunds,
      };
    } catch (error) {
      setIsBrokerConnected(false);
      return {migrationWillShow: false};
    }
  };

  const [isPerformerLoading, setIsPerformerLoading] = useState(false);
  const [bestPerformer, setbestPerformer] = useState();

  const getAllBestPerformers = async () => {
    try {
      setIsPerformerLoading(true);
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}comms/reco/best-performer-closed-advice/${configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain()}/30`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      setbestPerformer(response.data.bestPerformers);
    } catch (error) {
      console.error('Error fetching best performers:', error.response);
    } finally {
      setIsPerformerLoading(false);
    }
  };

  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [allNotifications, setAllNotifications] = useState(null);
  const notificationsInFlightRef = useRef(null);

  const getAllNotifcations = async (options = {}) => {
    // Don't fetch with an unresolved email — on login this can fire before
    // userEmail hydrates and would hit /get-user-notifications/undefined → 404.
    if (!userEmail) {
      setIsNotificationLoading(false);
      return;
    }
    const requestKey = `${userEmail}:${getTenantSubdomain(configData)}`;
    if (notificationsInFlightRef.current?.requestKey === requestKey) {
      return notificationsInFlightRef.current.promise;
    }

    const request = (async () => {
      try {
      // Cached notifications remain visible during background refreshes.
      // Blocking the entire screen on every mark-as-read caused the Alerts
      // list to flash a loader and lose its scroll position between taps.
      const shouldBlockScreen = !options.background && !allNotifications;
      if (shouldBlockScreen) setIsNotificationLoading(true);
      const response = await axios.get(
        `${server.server.baseUrl}api/sendnotification/get-user-notifications/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

        setAllNotifications(response.data.data);
        return response.data.data;
      } catch (error) {
      // 404 is the backend's "this user has no notification record yet" —
      // the normal state for a new / freshly-migrated account, not a
      // failure. Logging it at error level raised a red LogBox on every
      // launch. Treat it as an empty list; keep error level for the rest.
        if (error?.response?.status === 404) {
          setAllNotifications([]);
          return [];
        }
        console.error('Error fetching notifications', error);
        return null;
      } finally {
        setIsNotificationLoading(false);
      }
    })();
    notificationsInFlightRef.current = {requestKey, promise: request};
    try {
      return await request;
    } finally {
      if (notificationsInFlightRef.current?.promise === request) {
        notificationsInFlightRef.current = null;
      }
    }
  };

  const [pdf, setPdf] = useState([]);

  const fetchPdf = async () => {
    try {
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}/misc/pdfs?advisor=${advisortag}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      if (response) {
        const data = await response.data.pdfs;
        setPdf(data);
      } else {
        throw new Error('Failed to fetch pdfs');
      }
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const fetchVideos = async () => {
    setIsDatafetchingvideos(true);
    try {
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}/misc/videos?advisor=${advisortag}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      if (response) {
        const data = await response.data.videos;
        setVideos(data);
        setIsDatafetchingvideos(false);
      } else {
        throw new Error('Failed to fetch videos');
      }
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const [blogs, setBlogs] = useState([]);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(false);
  const [blogsError, setBlogsError] = useState(null);
  const [currentBlogsPage, setCurrentBlogsPage] = useState(1);
  const [totalBlogsPages, setTotalBlogsPages] = useState(0);
  const blogsPerPage = 9;

  const fetchBlogs = useCallback(
    async (page = 1) => {
      // console.log('this hitbpgppa', page);
      setLoading(true);
      setBlogsError(null);

      const endpoint = `${server.ccxtServer.baseUrl}misc/s3/blogs-content?page=${page}&limit=${blogsPerPage}`;

      try {
        const response = await axios.get(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        });

        if (response.data && response.data.data) {
          setBlogs(response.data.data.blogs || []);
          setTotalBlogsPages(response.data.data.totalPages || 0);
          setCurrentBlogsPage(response.data.data.currentPage || page);
        } else {
          setBlogs(response.data.blogs || response.data.items || []);
          setTotalBlogsPages(response.data.totalPages || 0);
          setCurrentBlogsPage(response.data.currentPage || page);
        }
      } catch (error) {
        console.error(
          'Error fetching blogs:',
          error.response?.data || error.message,
        );
        setBlogsError('Could not load blogs. Please try again later.');
        setBlogs([]);
        setTotalBlogsPages(0);
      } finally {
        setLoading(false);
      }
    },
    [advisortag, blogsPerPage, configData],
  );

  const [isProfileCompleted, setIsProfileCompleted] = useState(null);

  useEffect(() => {
    if (
      userDetails?.phone_number &&
      userDetails?.phone_number.toString().length >= 5
    ) {
      setIsProfileCompleted(true);
    } else {
      setIsProfileCompleted(false);
    }
  }, [userDetails]);

  // ENHANCED: Fetch data only when configData is available
  useEffect(() => {
    if (configData && advisortag) {
      console.log(
        '✅ TradeContext: Config available, fetching content data...',
      );
      fetchVideos();
      fetchBlogs();
      getAllBestPerformers();
      fetchPdf();
    } else {
      console.log(
        '⚠️ TradeContext: Waiting for config data before fetching content...',
      );
    }
  }, [advisortag, configData]);

  useEffect(() => {
    if (userEmail && configData) {
      console.log('✅ TradeContext: Config available, fetching user data...');
      getPlanList();
      // Refresh broker status on app launch — silent mode so the
      // migration modal doesn't pop "Reconnected to {broker}" at app
      // start (misleading; broker may actually need re-auth and user
      // didn't just reconnect). Migration modal only fires after an
      // explicit user reconnect action.
      fetchBrokerStatusModal({silent: true, refreshFunds: false});
    } else {
      console.log(
        '⚠️ TradeContext: Waiting for config data before fetching user data...',
      );
    }
  }, [userEmail, configData]);

  useEffect(() => {
    if (userDetails && configData) {
      // Broker identity belongs in global state, but balances are fetched by
      // funds-sensitive screens (or execution preflight), not on every global
      // user/config refresh.
      setBroker(userDetails?.user_broker);
    }
  }, [userDetails, configData]);

  useEffect(() => {
    if (userEmail && configData) {
      fetchVideos();
      getAllTrades();
      getAllNotifcations();
      getModelPortfolioStrategyDetails();
    }
  }, [userEmail, configData]);

  // Order-placement chokepoint. `OrderPlacedReferesh` covers only the screens
  // that remembered to emit it; several real placement paths never do
  // (MPReviewTradeModal, OrderService, ModelPortfolioService, AddtoCartModal,
  // IgnoreTradesScreen, and two of RebalanceModal's four submits). Rather than
  // sprinkle emits that the next new path will forget again, stamp every
  // */process-trade round-trip here. `getAllFunds` refuses to serve a cash
  // snapshot older than this stamp, so the next read — including the broker
  // screen's `maxAgeMs: 30000` focus read — always hits the broker.
  // Errors stamp too: a request can fail after the broker accepted the order.
  useEffect(() => {
    const isOrderPlacement = config =>
      typeof config?.url === 'string' && config.url.includes('process-trade');
    const stamp = config => {
      if (isOrderPlacement(config)) {
        lastOrderPlacedAtRef.current = Date.now();
      }
    };
    const interceptorId = axios.interceptors.response.use(
      response => {
        stamp(response?.config);
        return response;
      },
      error => {
        stamp(error?.config || error?.response?.config);
        return Promise.reject(error);
      },
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, []);

  // Account-wide invalidation boundary. Broker switches/connections and order
  // completion happen in several screens, but all of them already publish one
  // of these legacy events. Refresh broker identity first, then force cash and
  // home datasets with that same fresh user snapshot so no request is sent to
  // the previously active broker. A short second cash read covers brokers that
  // update buying power just after acknowledging the final order.
  useEffect(() => {
    if (!userEmail || !configData) return undefined;

    let cashRetryTimer;
    const refreshAccountState = async event => {
      // Reconnect / broker change / placed order: a cached get-repair answer
      // no longer describes the account.
      repairEpochRef.current += 1;
      lastRepairResultRef.current = null;
      const updatedUser = event?.freshUser || (await getUserDeatils());
      const refreshes = [
        getAllTrades(),
        getModelPortfolioStrategyDetails(),
        // Holdings no longer re-fetch on every user refresh (see
        // holdingsSessionKey), so order/refresh events request them here.
        getAllBrokerSpecificHoldings(),
        getAllHoldings(),
      ];
      if (event?.fundsAlreadyRefreshed !== true) {
        refreshes.push(
          getAllFunds({
            force: true,
            userDetailsOverride: updatedUser || userDetails,
          }),
        );
      }
      await Promise.allSettled(refreshes);
      clearTimeout(cashRetryTimer);
      if (event?.fundsAlreadyRefreshed === true) return;
      cashRetryTimer = setTimeout(() => {
        getAllFunds({
          force: true,
          userDetailsOverride: updatedUser || userDetails,
        }).catch(() => {});
      }, 2000);
    };

    eventEmitter.on('refreshEvent', refreshAccountState);
    eventEmitter.on('OrderPlacedReferesh', refreshAccountState);
    return () => {
      clearTimeout(cashRetryTimer);
      eventEmitter.removeListener('refreshEvent', refreshAccountState);
      eventEmitter.removeListener('OrderPlacedReferesh', refreshAccountState);
    };
    // Context loaders are recreated on render and would churn these global
    // subscriptions. Fresh user data is passed explicitly to the funds call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, configData, userDetails]);

  // Re-read subscriber and Repair status after broker reconciliation while suspended.
  const foregroundPortfolioRefreshRef = useRef(null);
  foregroundPortfolioRefreshRef.current = () => {
    if (userEmail && configData) {
      return getModelPortfolioStrategyDetails({silent: true, refreshRepair: true});
    }
  };
  useEffect(() => {
    return subscribePortfolioResume(AppState, () => foregroundPortfolioRefreshRef.current?.());
  }, []);

  // Re-fetch only trades when adviceShowDays changes (don't re-trigger everything)
  const adviceShowDaysInitialized = useRef(false);
  useEffect(() => {
    if (!adviceShowDaysInitialized.current) {
      adviceShowDaysInitialized.current = true;
      return; // Skip first run — already fetched above
    }
    if (userEmail && configData) {
      getAllTrades();
    }
  }, [adviceShowDays]);

  // for broker specigfic Holdings
  const [BrokerHoldingsData, setBrokerHoldingsData] = useState([]);
  const [lastBrokerHoldingsRefresh, setLastBrokerHoldingsRefresh] =
    useState(null);

  const getAllBrokerSpecificHoldings = async () => {
    if (
      broker === null ||
      broker === undefined ||
      broker === '' ||
      brokerStatus === 'Disconnected'
    ) {
      const snapshot = await loadBrokerHoldingsSnapshot(userEmail, broker);
      if (snapshot) {
        setBrokerHoldingsData(snapshot.holdings);
        setLastBrokerHoldingsRefresh(snapshot.refreshedAt);
      }
      return;
    }
    const {
      user_broker,
      clientCode,
      apiKey,
      jwtToken,
      secretKey,
      sid,
      viewToken,
      serverId,
    } = userDetails;

    try {
      const brokerSpecificHolding = await fetchBrokerSpecificHoldings(
        broker,
        clientCode,
        apiKey,
        jwtToken,
        secretKey,
        sid,
        viewToken,
        serverId,
        configData,
        userEmail,
      );
      if (brokerSpecificHolding) {
        const refreshedAt = new Date().toISOString();
        setBrokerHoldingsData(brokerSpecificHolding);
        setLastBrokerHoldingsRefresh(refreshedAt);
        saveBrokerHoldingsSnapshot({
          email: userEmail,
          broker,
          holdings: brokerSpecificHolding,
          refreshedAt,
        }).catch(() => {});
      } else {
        console.error('No funds fetched.');
      }
    } catch (error) {
      console.error('Error fetching funds:', error);
    }
  };

  // for broker specific all holdings calculation
  const [allHoldingsData, setAllHoldingsData] = useState();

  const getAllHoldings = async () => {
    if (
      broker === null ||
      broker === undefined ||
      broker === '' ||
      brokerStatus === 'Disconnected'
    ) {
      const snapshot = await loadBrokerHoldingsSummary(userEmail, broker);
      if (snapshot) {
        setAllHoldingsData(snapshot.summary);
        setLastBrokerHoldingsRefresh(current => current || snapshot.refreshedAt);
      }
      return;
    }
    const {
      user_broker,
      clientCode,
      apiKey,
      jwtToken,
      secretKey,
      sid,
      viewToken,
      serverId,
    } = userDetails;

    try {
      const allHoldings = await fetchBrokerAllHoldings(
        broker,
        clientCode,
        apiKey,
        jwtToken,
        secretKey,
        sid,
        viewToken,
        serverId,
        configData,
        userEmail,
      );
      if (allHoldings) {
        const refreshedAt = new Date().toISOString();
        setAllHoldingsData(allHoldings);
        saveBrokerHoldingsSummary({
          email: userEmail,
          broker,
          summary: allHoldings,
          refreshedAt,
        }).catch(() => {});
        return allHoldings;
      } else {
        console.error('No funds fetched.');
        return null;
      }
    } catch (error) {
      console.error('Error fetching funds:', error);
      return null;
    }
  };

  // Re-fetch broker holdings only when the broker SESSION changes (user,
  // broker, connection status, credentials) — not on every getUser refresh,
  // which returns a new object with the same session and used to fan one
  // Accept tap out into repeated live broker calls. Explicit refreshes
  // (order placed / refreshEvent) re-fetch holdings in refreshAccountState.
  const holdingsSessionKey = holdingsRefreshKey(userDetails);
  useEffect(() => {
    if (holdingsSessionKey) {
      setBroker(userDetails?.user_broker);
      getAllBrokerSpecificHoldings();
      getAllHoldings();
    }
    // Loaders are recreated every render; the session key is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsSessionKey]);

  const [marketPrices, setMarketPrices] = useState({});

  const fetchMarketPrices = async symbols => {
    try {
      const data = JSON.stringify({
        Orders: symbols.map(sym => ({
          exchange: 'NSE', // adjust if required per symbol
          segment: '',
          tradingSymbol: sym,
        })),
      });

      console.log('data', data);
      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}angelone/market-data`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data,
      };

      const response = await axios.request(config);
      const pricesMap = {};
      response?.data?.data?.fetched?.forEach(item => {
        pricesMap[item.tradingSymbol] = item.ltp;
      });

      setMarketPrices(pricesMap);
    } catch (error) {
      console.error('Error fetching market prices:', error);
    }
  };

  const markPnlRangeActivated = useCallback(
    async ({id, marketPrice}) => {
      if (!id || !Number.isFinite(Number(marketPrice))) {
        return false;
      }

      const applyActivation = trades =>
        trades.map(trade =>
          String(trade?._id) === String(id)
            ? {
                ...trade,
                pnlRangeActivated: true,
                pnlActivatedAt:
                  trade.pnlActivatedAt || new Date().toISOString(),
                pnlActivationPrice: Number(marketPrice),
              }
            : trade,
        );

      // The price has entered the range, so reflect activation immediately.
      // The API call below makes that one-way state durable across sessions.
      setstockRecoNotExecutedfinal(applyActivation);
      setrecommendationStockfinal(applyActivation);

      try {
        const accountEmail = await getAccountEmailAsync();
        if (!accountEmail) {
          return false;
        }

        await axios.put(
          `${server.server.baseUrl}api/user/trade-reco/${encodeURIComponent(
            id,
          )}/activate-pnl`,
          {
            user_email: accountEmail,
            market_price: Number(marketPrice),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        return true;
      } catch (error) {
        console.warn(
          '[P&L activation] Could not persist range activation:',
          error?.response?.data?.error || error.message,
        );
        return false;
      }
    },
    [configData],
  );

  return (
    <TradeContext.Provider
      value={{
        isProfileCompleted,
        userEmail,
        planList,
        setIsProfileCompleted,
        setVideos,
        setHasFetchedTrades,
        blogs,
        fetchBlogs,
        pdf,
        videos,
        fetchVideos,
        modelPortfolioStrategyfinal,
        modelPortfolioEntitlementsLoaded,
        modelPortfolioEntitlementsStatus,
        stockRecoNotExecutedfinal,
        recommendationStockfinal,
        isDatafetching,
        getAllTrades,
        markPnlRangeActivated,
        getModelPortfolioStrategyDetails,
        // Repair UI — see docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g
        modelPortfolioRepairTrades,
        isDatafetchinRepair,
        repairReconciliation,
        getModelPortfolioRepairTrades,
      getRecentRepairResult,
        markSkipRepairForModelId,
        shouldSkipRepairForModelId,
        rejectedTrades,
        isDatafetchingvideos,
        ignoredTrades,
        isDatafetchinMP,
        userDetails,
        setUserDetails,
        setFunds,
        setBroker,
        setstockRecoNotExecutedfinal,
        setModelPortfolioStrategyfinal,
        isBrokerConnected,
        allNotifications,
        getAllNotifcations,
        isNotificationLoading,
        broker,
        brokerStatus,
        getUserDeatils,
        funds,
        confirmedFunds,
        fundsLoading,
        fundsError,
        getAllFunds,
        bestPerformer,
        isPerformerLoading,
        fetchBrokerStatusModal,
        showMigrationModal,
        setShowMigrationModal,
        migrationBroker,
        getAllBestPerformers,
        fetchPdf,
        setUserDetails,
        getPlanList,
        configData,
        configLoading,
        reloadConfigData, // NEW: Expose this function to force reload config
        //for broker specific holdings
        BrokerHoldingsData,
        getAllBrokerSpecificHoldings,
        lastBrokerHoldingsRefresh,
        allHoldingsData,
        setAllHoldingsData,
        getAllHoldings,
        marketPrices,
        fetchMarketPrices,
        // Basket helper functions
        netBasketTrades,
        isBasketEdited,
        isBasketExpired,
        isValidSymbolExpiry,
        // Order Book functions for reconciliation
        fetchBrokerOrderBook,
        getPendingOrdersForSymbol,
        startAutoRefresh,
        stopAutoRefresh,
        brokerOrders,
        pendingOrders,
        isOrderBookLoading,
        orderBookError,
      }}>
      {children}
    </TradeContext.Provider>
  );
};
