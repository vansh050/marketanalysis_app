import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { XIcon, CandlestickChartIcon, AlertOctagon, CheckIcon, AlertTriangle } from 'lucide-react-native';
import server from '../../utils/serverConfig';
import IsMarketHours from '../../utils/isMarketHours';
import { computeTradeVariant } from '../../utils/tradeVariant';
import { useConfig } from '../../context/ConfigContext';
import axios from 'axios';
import DummyBrokerHoldingConfirmation from './DummyBrokerHoldingConfirmation';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import WebView from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import eventEmitter from '../../components/EventEmitter';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
import {
  buildBrokerPayloadFields,
  defaultDecrypt,
  isBrokerAuthError,
  detectTransientOrderWindowError,
  isCautionaryListingMessage,
  isInsufficientFundsMessage,
} from '../../utils/rebalanceHelpers';
import useModalStore from '../../GlobalUIModals/modalStore';
const { height: screenHeight } = Dimensions.get('window');
import StepProgressBar from '../../UIComponents/RebalanceAdvicesUI/StepProgressBar';
import TotalAmountTextRebalance from './DynamicText/totalAmountRebalance';
import { useTrade } from '../../screens/TradeContext';
import Toast from 'react-native-toast-message';
import debounce from 'lodash.debounce';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import { validateBrokerSession } from '../../utils/brokerSessionUtils';
import { validateStockExchanges, applyKiteMarketProtection, getPublisherWebViewBaseUrl, resolveZerodhaSymbol } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import useKitePublisherPolling from '../../hooks/useKitePublisherPolling';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { convertResponse } from '../../utils/tradeUtils';
import { isZerodhaSellAuthorized } from '../../utils/zerodhaDdpiGate';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import useSdkClient from '../../sdk/useSdkClient';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

const RebalanceModal = ({
  userEmail,
  visible,
  setOpenRebalanceModal,
  data,
  calculatedPortfolioData,
  broker,
  apiKey,
  userDetails,
  jwtToken,
  secretKey,
  clientCode,
  sid,
  serverId,
  viewToken,
  setOpenSucessModal,
  setOrderPlacementResponse,
  // Optional — sibling setter for the outgoing trade list at submit
  // time. Lets RecommendationSuccessModal recover `variant` per row when
  // ccxt-india doesn't echo it (rebalance/MP lane). See
  // utils/tradeVariant.js § resolveResultVariant.
  setLastSubmittedTrades,
  modelPortfolioModelId,
  modelPortfolioRepairTrades,
  getRebalanceRepair,
  storeModalName,
  getModelPortfolioStrategyDetails,
  setShowAngleOneTpinModel,
  setShowFyersTpinModal,
  setShowDhanTpinModel,
  setShowOtherBrokerModel,
  setIsReturningFromOtherBrokerModal,
  isReturningFromOtherBrokerModal,
  rebalanceExecutionStatus,
  edisStatus,
  dhanEdisStatus,
  setShowDdpiModal,
}) => {
  const { brokerStatus, configData } = useTrade();
  const openBrokerModal = useModalStore(state => state.openModal);
  // Hoist `allowAfterHoursOrders` to the top of the component body so it's
  // in scope for the trade `variant` computations in the submit handlers
  // below. There used to be a second `useConfig()` destructure further down
  // (used by the `marketGateOpen` review-trade gate) — that's been removed
  // since both refer to the same value. See docs/APP_ARCHITECTURE.md
  // § 4.5.2 Trade variant field.
  const { allowAfterHoursOrders } = useConfig() || {};
  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;
  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
  // Add fallback for API key
  let zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config?.REACT_APP_ZERODHA_API_KEY;
  if (!zerodhaApiKey) {
    console.log('[RebalanceModal] WARNING: API key not found!');
  } else {
    console.log('[RebalanceModal] Using API key:', zerodhaApiKey.substring(0, 4) + '...');
  }
  const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

  // Helper functions for Kite basket
  const mapKiteProductType = (productType) => {
    if (!productType) return "CNC";
    const upper = productType.toUpperCase();
    if (upper === "DELIVERY" || upper === "CNC") return "CNC";
    if (upper === "INTRADAY" || upper === "MIS") return "MIS";
    if (upper === "BO") return "BO";
    if (upper === "CO") return "CO";
    return "CNC";
  };

  const mapKiteOrderType = (orderType) => {
    if (!orderType) return "MARKET";
    const upper = orderType.toUpperCase();
    if (upper === "MARKET") return "MARKET";
    if (upper === "LIMIT") return "LIMIT";
    if (upper === "SL" || upper === "SL_M" || upper === "STOP") return "SL";
    return "MARKET";
  };

  // Zerodha WebView state
  const webViewRef = useRef(null);
  const [webView, setWebView] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);

  // Publisher order-book polling fallback for Kite Publisher WebView
  // callback misses. Canonical implementation lives in
  // `src/hooks/useKitePublisherPolling.js` — see
  // docs/REBALANCING.md § Kite Publisher polling fallback for the
  // full contract (failure modes, double-fire protection, layer-2
  // server-side `add-user/status-check-queue` fallback). When the
  // hook detects new orders OR times out, it drives the same state
  // transition the WebView callback would have driven, so downstream
  // `checkZerodhaStatus` runs identically through both channels.
  const { start: startOrderPolling, stop: stopOrderPolling } = useKitePublisherPolling({
    broker,
    brokerCreds: { clientCode, apiKey, jwtToken, secretKey, sid, serverId },
    configData,
    onPublisherSettled: () => {
      setWebView(false);
      setZerodhaStatus('success');
      setZerodhaRequestType('rebalance');
    },
  });
  console.log("Calculated Portfolio Data---", calculatedPortfolioData);

  // Parse skipped stocks message
  const skippedStocksMessage = calculatedPortfolioData?.message;
  const hasSkippedStocks =
    skippedStocksMessage &&
    skippedStocksMessage.includes('Stocks not bought due to low allowed balance');

  const skippedStocksList = hasSkippedStocks
    ? skippedStocksMessage
      .split('Stocks not bought due to low allowed balance:')[1]
      ?.split(',')
      .map(s => s.trim())
      .filter(s => s)
    : [];

  // Get minimum investment from model portfolio data
  const minInvestment = calculatedPortfolioData?.minInvestmentValue;
  console.log("min investment", minInvestment)
  const [currentStep, setCurrentStep] = useState(3);
  const stepsData = [1, 2, 3];

  // NEW: Check if broker is disconnected
  const isBrokerDisconnected =
    brokerStatus === 'Disconnected' || brokerStatus === undefined;

  const [editableData, setEditableData] = useState([]);

  // Calculate required fund from editableData
  const calculateRequiredFund = () => {
    let total = 0;
    editableData.forEach(item => {
      const price = parseFloat(item.editablePrice) || 0;
      const qty = parseInt(item.editableQty) || 0;
      if (item.orderType === 'BUY') {
        total += price * qty;
      } else if (item.orderType === 'SELL') {
        total -= price * qty;
      }
    });
    return total < 0 ? 0 : total;
  };

  // NEW: State for DummyBroker modal
  const [showDummyBrokerModal, setShowDummyBrokerModal] = useState(false);

  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState();

  const filteredData = data.filter(item => item.model_name === storeModalName);

  // Now, let's find the matching repair trade
  const matchingRepairTrade =
    modelPortfolioRepairTrades &&
    modelPortfolioRepairTrades?.find(
      trade => trade.modelId === modelPortfolioModelId,
    );

  const repairStatus =
    matchingRepairTrade &&
    matchingRepairTrade.failedTrades &&
    matchingRepairTrade.failedTrades.length > 0;

  // Check if modelPortfolioRepairTrades exists and has trades
  let dataArray = [];
  // Flag used downstream to render the repair-row chip + CTA. True only
  // when we entered the modal via the repair-shortcut branch (failedTrades
  // pre-populated the rows).
  const isRepairMode =
    repairStatus && rebalanceExecutionStatus && rebalanceExecutionStatus !== "toExecute";
  if (isRepairMode) {
    dataArray =
      matchingRepairTrade?.failedTrades
        ?.filter((trade) => !trade?.advSymbol?.includes("CASH-EQ"))
        ?.map((trade) => ({
          symbol: trade?.advSymbol,
          qty: parseInt(trade?.advQTY, 10),
          orderType: trade?.transactionType.toUpperCase(),
          exchange: trade?.advExchange,
          zerodhaTradeId: trade?.zerodhaTradeId,
          token: trade?.token ? trade?.token : "",
          // Carry original-rejection fields through to row-render so the
          // cautionary / LOW_FUNDS chip can be marked per-row. ccxt-india
          // `rebalancing/utils/db_manager.repair()` populates these from
          // `order_results[i]` on the latest advice. See
          // docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
          orderStatusMessage: trade?.orderStatusMessage || '',
          classification: trade?.classification,
          // Repair metadata for the row tooltip / "what was filled vs
          // requested" affordance (partial-fill case from db_manager).
          originalQty: trade?.originalQty,
          filledQty: trade?.filledQty,
          isPartialFill: trade?.isPartialFill,
        })) || [];
  } else if (calculatedPortfolioData && calculatedPortfolioData?.length !== 0) {
    dataArray =
      calculatedPortfolioData?.length !== 0
        ? [
          ...(calculatedPortfolioData?.buy
            ?.filter((item) => !item?.symbol?.includes("CASH-EQ"))
            ?.map((item) => ({
              symbol: item.symbol,
              token: item?.token ? item?.token : "",
              qty: item.quantity,
              orderType: "BUY",
              exchange: item.exchange,
              zerodhaTradeId: item.zerodhaTradeId,
              rebalancePrice: item.rebalance_price,
            })) || []),
          ...(calculatedPortfolioData?.sell
            ?.filter((item) => !item?.symbol?.includes("CASH-EQ"))
            ?.map((item) => ({
              symbol: item.symbol,
              token: item?.token ? item?.token : "",
              qty: item.quantity,
              orderType: "SELL",
              exchange: item.exchange,
              zerodhaTradeId: item.zerodhaTradeId,
              rebalancePrice: item.rebalance_price,
            })) || []),
        ]
        : [];
  }

  // Scripmaster-corrected symbol/exchange map from ccxt-india. Used to
  // (a) subscribe the LTP websocket on the *corrected* exchange for
  // BE-series / BSE-primary stocks (e.g. VIKASECO-EQ → VIKASECO on BSE),
  // and (b) rewrite `tradingsymbol`/`exchange` in the Kite publisher basket
  // so Kite doesn't silently drop the item. See brokerPublisher.js
  // `resolveZerodhaSymbol()` for the fallthrough rules.
  const symbolMap = useZerodhaSymbolMap(dataArray, visible);

  // Real-time prices via WebSocket (matching web app pattern). Symbols are
  // mapped through `resolveZerodhaSymbol` so the hook subscribes with the
  // corrected exchange — otherwise the NSE feed returns nothing for a
  // BSE-primary symbol and `applyKiteMarketProtection` falls through.
  const wsSymbols = visible
    ? dataArray.map(item => {
        const resolved = resolveZerodhaSymbol(item, symbolMap);
        return {
          ...item,
          symbol: resolved.tradingsymbol || item.symbol,
          tradingSymbol: resolved.tradingsymbol || item.tradingSymbol,
          exchange: resolved.exchange || item.exchange,
        };
      })
    : [];
  const { getLTPForSymbol: wsGetLTP } = useWebSocketCurrentPrice(wsSymbols);

  // REST fallback for initial load (WebSocket may take a moment to connect).
  // Uses advice-side {symbol, exchange} — but note that for BE-series / BSE-
  // primary stocks whose advice is stale (VIKASECO-EQ tagged NSE but
  // actually BSE-primary), Angel One returns no LTP on NSE. The authoritative
  // fix is server-side: /zerodha/convert-symbol's `ltp` field falls through
  // to a live fetch on the resolved exchange when the Redis cache is cold.
  // See ccxt-india app_zerodha.py: _get_cached_ltp / convert_symbol().
  const [restPrices, setRestPrices] = useState({});
  useEffect(() => {
    if (!visible || dataArray.length === 0) return;
    const fetchInitialPrices = async () => {
      try {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}angelone/market-data`,
          {
            Orders: dataArray.map(item => ({
              exchange: item.exchange || 'NSE',
              segment: '',
              tradingSymbol: item.symbol,
            })),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        const pricesMap = {};
        response?.data?.data?.fetched?.forEach(item => {
          pricesMap[item.tradingSymbol] = item.ltp;
        });
        setRestPrices(pricesMap);
      } catch (error) {
        console.error('Error fetching initial market prices:', error);
      }
    };
    fetchInitialPrices();
  }, [visible]);

  // Unified LTP getter. Preference order:
  //   1. WebSocket on the scripmaster-resolved symbol (e.g. 'VIKASECO' subscribed on BSE)
  //   2. WebSocket on the raw advice-side symbol ('VIKASECO-EQ' on NSE)
  //   3. REST-fetched (Angel One) market-data price on the raw symbol
  //   4. Scripmaster Redis-cached `ltp` from /zerodha/convert-symbol
  // (4) is load-bearing for BE-series / BSE-primary stocks whose NSE ws
  // feed never emits — without it the Step-3 review shows ₹0 for
  // VIKASECO-EQ even though Kite's own confirmation page has the LTP.
  const getLTPForSymbol = useCallback(
    symbol => {
      if (!symbol) return null;
      const info = symbolMap?.[symbol];
      const resolvedSym = info?.zerodha_symbol;
      if (resolvedSym) {
        const wsResolved = wsGetLTP(resolvedSym);
        if (wsResolved && wsResolved > 0) return wsResolved;
      }
      const wsPrice = wsGetLTP(symbol);
      if (wsPrice && wsPrice > 0) return wsPrice;
      const restPrice = restPrices[symbol];
      if (restPrice && restPrice > 0) return restPrice;
      if (info?.ltp && info.ltp > 0) return info.ltp;
      return null;
    },
    [wsGetLTP, restPrices, symbolMap],
  );

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    if (
      visible &&
      isBrokerDisconnected &&
      dataArray.length > 0
    ) {
      // Initialize as soon as market prices are available, or fallback to rebalance prices
      if (Object.keys(restPrices).length > 0) {
        initializeEditableData();
      } else if (dataArray.some(item => item.rebalancePrice)) {
        // Use rebalance prices from API response as fallback
        initializeEditableData();
      }
    }
  }, [visible, restPrices, isBrokerDisconnected, dataArray]);

  // Auto-mark "already aligned" as executed in DB for DummyBroker
  // Mirrors the same flow as DummyBrokerHoldingConfirmation:
  // 1. process-trade (empty trades) -> 2. update subscriber-execution -> 3. status-check-queue
  const alreadyAlignedMarkedRef = useRef(false);
  useEffect(() => {
    if (!visible || !isBrokerDisconnected) return;

    // Match prod's "already aligned" detection:
    // Must have calculated data with buy/sell arrays but both empty after filtering
    const isAlreadyAligned =
      dataArray.length === 0 &&
      calculatedPortfolioData &&
      !Array.isArray(calculatedPortfolioData) &&
      Array.isArray(calculatedPortfolioData?.buy) &&
      Array.isArray(calculatedPortfolioData?.sell);

    if (!isAlreadyAligned || alreadyAlignedMarkedRef.current) return;
    alreadyAlignedMarkedRef.current = true;

    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };

    const markAsExecuted = async () => {
      try {
        // SDK executeAdvice dual-path (Phase C) — DummyBroker already-aligned
        // (empty trades). SDK path when flag is on; legacy below as fallback.
        let alreadyAlignedDone = false;
        if (sdkExecuteAdviceEnabled) {
          try {
            await sdkClient.executeAdvice(
              {
                kind: 'mpRebalance',
                clientAdviceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                brokerName: 'DummyBroker',
                modelId: modelPortfolioModelId,
                modelName: storeModalName,
                uniqueId: calculatedPortfolioData?.uniqueId,
                trades: [],
              },
              // skipReview + presentResult=false — host owns both UIs.
              { skipReview: true, presentResult: false },
            );
            alreadyAlignedDone = true;
            console.log('[RebalanceModal] SDK executeAdvice (already-aligned) completed');
          } catch (sdkErr) {
            console.error('[RebalanceModal] SDK executeAdvice (already-aligned) failed, falling back to legacy:', sdkErr?.message);
          }
        }

        if (!alreadyAlignedDone) {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/process-trade`,
            {
              user_broker: 'DummyBroker',
              user_email: userEmail,
              trades: [],
              model_id: modelPortfolioModelId,
              modelName: storeModalName,
              advisor: advisorTag,
              unique_id: calculatedPortfolioData?.uniqueId,
            },
            {headers: requestHeaders},
          );
        }

        await axios.put(
          `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
          {
            userEmail: userEmail,
            modelName: storeModalName,
            model_id: modelPortfolioModelId,
            executionStatus: 'executed',
            user_broker: 'DummyBroker',
          },
          {headers: requestHeaders},
        );

        // NOTE: Prod skips status-check-queue for DummyBroker "already aligned" case
        // (no background poller needed when no real broker orders exist)
        // NOTE: Prod emits NO events in already-aligned flow — delayed refresh handles UI update

        // Delayed refresh to allow cross-server DB sync (matching prod: 1.5s, 4s, 8s)
        setTimeout(() => getModelPortfolioStrategyDetails(), 1500);
        setTimeout(() => getModelPortfolioStrategyDetails(), 4000);
        setTimeout(() => getModelPortfolioStrategyDetails(), 8000);
      } catch (err) {
        console.error('Error auto-marking already-aligned as executed:', err);
      }
    };

    markAsExecuted();
  }, [visible, isBrokerDisconnected, calculatedPortfolioData, dataArray, userEmail, storeModalName, modelPortfolioModelId, getModelPortfolioStrategyDetails]);

  // Reset already-aligned flag when modal closes
  useEffect(() => {
    if (!visible) {
      alreadyAlignedMarkedRef.current = false;
    }
  }, [visible]);

  // Clear on modal close
  useEffect(() => {
    if (!visible) {
      setEditableData([]);
      initializedRef.current = false;
    }
  }, [visible]);

  const initializeEditableData = useCallback(() => {
    if (initializedRef.current) return;

    const initialData = dataArray.map(item => ({
      ...item,
      editablePrice: getLTPForSymbol(item.symbol) || item.rebalancePrice || 0,
      editableQty: item.qty,
      id: item.symbol,
    }));

    setEditableData(initialData);
    initializedRef.current = true;
  }, [dataArray, getLTPForSymbol, restPrices]);

  // NEW: Function to open DummyBroker confirmation modal

  const [showPriceErrorModal, setShowPriceErrorModal] = useState(false);

  const validatePriceBeforeConfirm = () => {
    const anyZeroPrice = editableData.some(
      item => parseFloat(item.editablePrice) === 0,
    );
    if (anyZeroPrice) {
      setShowPriceErrorModal(true);
      return false;
    }
    return true;
  };

  const openDummyBrokerConfirmation = () => {
    if (validatePriceBeforeConfirm()) {
      setShowDummyBrokerModal(true);
    }
  };

  // NEW: Function to close DummyBroker confirmation modal
  const closeDummyBrokerConfirmation = () => {
    setShowDummyBrokerModal(false);
  };

  const rawStockDetails = convertResponse(dataArray, broker);

  // SELLs in the rebalance response are already netted by the backend against
  // the user's actual holdings (resultant_of_net_and_holding), so any SELL the
  // backend emits is a real exit of a held position. The previous client-side
  // filter required an EXACT match on the FULL symbol (incl. -EQ/-BE/-SM
  // suffix), which SILENTLY dropped a SELL whenever the held symbol's
  // exchange-series suffix differed (e.g. holdings stored as "GTLINFRA-EQ" vs
  // a post-series-migration "GTLINFRA-BE" sell). Silently hiding an exit is
  // the worst failure mode — the backend still executes the SELL, but the
  // user never reviews it. We now keep ALL backend SELLs and only LOG (never
  // drop) when a sell's BASE symbol isn't found in holdings, for
  // observability. Ported from web parity commit 344b7766.
  const stockDetails = (() => {
    const userHoldings = calculatedPortfolioData?.userHoldings || calculatedPortfolioData?.user_net_pf_model;
    if (!Array.isArray(userHoldings) || userHoldings.length === 0) return rawStockDetails;
    const baseSym = (s) => (s || '').toUpperCase().split('-')[0];
    const heldBaseSymbols = new Set();
    userHoldings.forEach(h => {
      const sym = h?.symbol || h?.tradingSymbol || '';
      const qty = h?.quantity || h?.qty || 0;
      if (sym && qty > 0) heldBaseSymbols.add(baseSym(sym));
    });
    if (heldBaseSymbols.size === 0) return rawStockDetails;
    rawStockDetails.forEach(item => {
      if ((item.transactionType || '').toUpperCase() !== 'SELL') return;
      const sym = item.tradingSymbol || item.symbol || '';
      if (!heldBaseSymbols.has(baseSym(sym))) {
        console.warn(
          `[RebalanceModal] SELL ${sym} not matched in current holdings (base-symbol) — showing anyway; backend nets sells against holdings.`,
        );
      }
    });
    return rawStockDetails;
  })();

  // --- Zerodha Publisher Flow Functions ---

  const generateHtmlForm = (basket, apiKey) => {
    return `<html>
      <body>
        <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
          <input type="hidden" name="api_key" value="${apiKey}" />
          <input type="hidden" name="data" value='${JSON.stringify(basket)}' />
          <input type="hidden" name="redirect_params" value="test=true" />
        </form>
        <script>
          document.getElementById('zerodhaForm').submit();
        </script>
      </body>
    </html>`;
  };

  const getAdditionalPayload = () => {
    const matchingRepairTrade =
      modelPortfolioRepairTrades &&
      modelPortfolioRepairTrades?.find(
        trade => trade.modelId === modelPortfolioModelId,
      );
    if (matchingRepairTrade) {
      return {
        modelName: matchingRepairTrade.modelName,
        advisor: advisorTag,
        unique_id: matchingRepairTrade?.uniqueId,
        model_id: modelPortfolioModelId,
        broker: broker,
      };
    } else {
      return {
        modelName: filteredData[0]['model_name'],
        advisor: advisorTag,
        unique_id: calculatedPortfolioData?.uniqueId,
        model_id: modelPortfolioModelId,
        broker: broker,
      };
    }
  };

  const additionalPayload = getAdditionalPayload();

  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;
    console.log('Rebalance WebView URL:', url);
    if (url.includes('success') || url.includes('completed')) {
      console.log('Zerodha success redirect detected:', url);
      setZerodhaStatus('success');
      setZerodhaRequestType('rebalance');
    }
  };

  const handleZerodhaRedirect = async () => {
    // Pre-flight: refuse to send orders with missing exchange. Kite Publisher
    // silently drops basket items whose symbol/exchange combo it can't resolve.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      console.error('[ZerodhaPublisher] Blocked due to missing exchange:', missingList);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: `Missing exchange for: ${missingList}. Please contact your manager.`,
        visibilityTime: 8000,
      });
      return;
    }

    setLoading(true);
    try {
      // Cross-publisher cleanup — also wipe Fyers pending state so a
      // prior partial Fyers attempt doesn't replay on next mount.
      // Per SDK_ORCHESTRATION_AUDIT.md § Pass 2 / Suspected defect #3.
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');
      await AsyncStorage.removeItem('stockDetailsFyersOrder');
      await AsyncStorage.setItem(
        'zerodhaAdditionalPayload',
        JSON.stringify(additionalPayload),
      );

      const basket = stockDetails.map(stock => {
        // Resolve advice-side `tradingSymbol`/`exchange` through ccxt-india's
        // scripmaster. Handles -EQ stripping, BE→BSE diversion, BSE-primary
        // stocks mislabeled NSE. `cachedLtp` is a Redis-cached server-side
        // price that lets applyKiteMarketProtection fire even when the
        // user's live WebSocket hasn't emitted anything (common for
        // BE-series stocks like VIKASECO where NSE feed has no data).
        const resolved = resolveZerodhaSymbol(stock, symbolMap);
        const liveLtp = getLTPForSymbol(resolved.tradingsymbol)
          || getLTPForSymbol(stock.tradingSymbol);
        const ltp = liveLtp && liveLtp > 0 ? liveLtp : (resolved.cachedLtp || 0);
        let orderPrice = 0;

        if (stock.orderType === 'LIMIT') {
          orderPrice = parseFloat(stock.price || 0);
        } else if (stock.orderType === 'MARKET' || stock.orderType === 'SL') {
          orderPrice = ltp && ltp !== '-' ? parseFloat(ltp) : 0;
        }

        // Build tag from zerodhaTradeId for order tracking/reconciliation (matching prod)
        const tradeTag = (stock.zerodhaTradeId || stock.tradeId || '').substring(0, 20);

        let baseOrder = {
          variety: 'regular',
          tradingsymbol: resolved.tradingsymbol,
          // exchange is guaranteed non-empty by validateStockExchanges() above;
          // resolved.exchange prefers the scripmaster answer over stock.exchange.
          exchange: resolved.exchange,
          transaction_type: (stock.transactionType || 'BUY').toUpperCase(),
          order_type: mapKiteOrderType(stock.orderType),
          quantity: parseInt(stock.quantity, 10) || 1,
          product: mapKiteProductType(stock.productType),
          readonly: false,
          price: orderPrice,
          tag: tradeTag,
        };

        if (stock.quantity > 100) {
          baseOrder.readonly = true;
        }

        // MARKET → LIMIT-IOC with 1% market-protection buffer for GSM/T2T/BE stocks.
        const protectedOrder = applyKiteMarketProtection(baseOrder, ltp, stock.transactionType);
        console.log('[RebalanceModal] Basket item:', JSON.stringify(protectedOrder));
        return protectedOrder;
      });

      const currentISTDateTime = new Date();

      await axios
        .post(
          `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
          {
            stockDetails: stockDetails,
            leaving_datetime: currentISTDateTime,
            email: userEmail,
            trade_given_by: advisorTag,
          },
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
        )
        .then(res => {
          const allStockDetails = res?.data?.data;
          const filteredStockDetails = allStockDetails.map(detail => ({
            user_email: detail.user_email,
            trade_given_by: detail.trade_given_by,
            tradingSymbol: detail.Symbol,
            transactionType: detail.Type,
            exchange: detail.Exchange,
            segment: detail.Segment,
            productType: detail.ProductType,
            orderType: detail.OrderType,
            price: detail.Price,
            quantity: detail.Quantity,
            priority: detail.Priority,
            tradeId: detail.tradeId,
            user_broker: 'Zerodha',
          }));

          setLoading(false);
          AsyncStorage.setItem(
            'stockDetailsZerodhaOrder',
            JSON.stringify(filteredStockDetails),
          );
        })
        .catch(err => {
          console.log('Error updating Zerodha reco:', err);
          setLoading(false);
        });

      const htmlForm = generateHtmlForm(basket, zerodhaApiKey);
      setHtmlContent(htmlForm);
      setWebView(true);

      // Start order-book polling fallback. The hook resets its own
      // internal processed flag, so we don't need a separate reset here.
      startOrderPolling();
    } catch (error) {
      console.error('Failed to handle Zerodha redirect:', error);
      setLoading(false);
    }
  };

  const fetchZerodhaData = async () => {
    try {
      const pendingOrderData = await AsyncStorage.getItem(
        'stockDetailsZerodhaOrder',
      );
      const payloadData = await AsyncStorage.getItem(
        'zerodhaAdditionalPayload',
      );
      const zerodhaStockDetails = pendingOrderData
        ? JSON.parse(pendingOrderData)
        : null;
      const zerodhaAdditionalPayload = payloadData
        ? JSON.parse(payloadData)
        : null;
      return { zerodhaStockDetails, zerodhaAdditionalPayload };
    } catch (error) {
      console.error('Error fetching Zerodha data from AsyncStorage:', error);
      return { zerodhaStockDetails: null, zerodhaAdditionalPayload: null };
    }
  };

  const checkZerodhaStatus = async () => {
    // Stop polling — normal WebView callback is proceeding. The hook's
    // stop() flips the internal processed flag so any in-flight poll
    // tick short-circuits before re-firing onPublisherSettled.
    stopOrderPolling();

    const { zerodhaStockDetails, zerodhaAdditionalPayload } =
      await fetchZerodhaData();

    if (
      zerodhaStatus !== null &&
      zerodhaAdditionalPayload !== null &&
      zerodhaStockDetails !== null &&
      zerodhaRequestType === 'rebalance'
    ) {
      try {
        // Use publisher/record-orders endpoint - this fetches order book from Zerodha
        // and matches orders with our trade list
        const requestHeaders = {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        };

        console.log('[RebalanceModal] Recording publisher orders...');

        const recordResponse = await axios.post(
          `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
          {
            stockDetails: zerodhaStockDetails,
            publisherResults: [{ status: 'success', batchIndex: 0 }],
            userEmail: userEmail,
            broker: 'Zerodha',
            model_id: zerodhaAdditionalPayload.model_id,
            modelName: zerodhaAdditionalPayload.modelName,
            advisor: zerodhaAdditionalPayload.advisor,
            unique_id: zerodhaAdditionalPayload.unique_id,
            caPendingInfo: calculatedPortfolioData?.caPendingInfo || [],
          },
          { headers: requestHeaders }
        );

        console.log('[RebalanceModal] Record orders response:', recordResponse.data);

        const orderResults = recordResponse.data.response || recordResponse.data.results || [];

        // Update subscriber execution status (matching web app)
        const successStatuses = ['complete', 'executed', 'traded'];
        const pendingStatuses = ['open', 'pending', 'transit', 'placed', 'trigger pending', 'after market order req received'];
        const pubSuccessCount = orderResults.filter(r =>
          successStatuses.includes((r.orderStatus || '').toLowerCase()),
        ).length;
        let executionStatus;
        if (pubSuccessCount === orderResults.length) {
          executionStatus = 'executed';
        } else if (pubSuccessCount > 0) {
          executionStatus = 'partial';
        } else {
          const hasPendingOrders = orderResults.some(r =>
            pendingStatuses.includes((r.orderStatus || '').toLowerCase()),
          );
          executionStatus = hasPendingOrders ? 'pending' : 'toExecute';
        }

        try {
          await axios.put(
            `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
            {
              userEmail: userEmail,
              modelName: zerodhaAdditionalPayload.modelName,
              model_id: zerodhaAdditionalPayload.model_id || modelPortfolioModelId,
              executionStatus: executionStatus,
              user_broker: 'Zerodha',
            },
            { headers: requestHeaders },
          );
        } catch (err) {
          console.warn('[ZerodhaPublisher] subscriber-execution update failed:', err);
        }

        // Record publisher results (matching prod)
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
            {
              modelName: zerodhaAdditionalPayload.modelName,
              model_id: zerodhaAdditionalPayload.model_id,
              unique_id: zerodhaAdditionalPayload.unique_id,
              advisor: zerodhaAdditionalPayload.advisor,
              order_results: orderResults,
              user_email: userEmail,
              user_broker: 'Zerodha',
            },
            { headers: requestHeaders },
          );
          console.log('[ZerodhaPublisher] Successfully recorded publisher results');
        } catch (err) {
          console.warn('[ZerodhaPublisher] record-publisher-results failed:', err);
        }

        setOrderPlacementResponse(orderResults);
        // Zerodha publisher lane — outgoing trades variant-tagged below
        // would normally come from `tradesWithVariant`, but at this point
        // in the function scope only `zerodhaStockDetails` is available.
        // Tag them on the spot for the fallback lookup.
        setLastSubmittedTrades?.(
          (zerodhaStockDetails || []).map(t => ({
            ...t,
            variant: t?.variant || computeTradeVariant(allowAfterHoursOrders),
          })),
        );
        setOpenSucessModal(true);
        setOpenRebalanceModal(false);
        eventEmitter.emit('OrderPlacedReferesh');

        // Emit structured portfolio events (matching prod)
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
          userEmail,
          modelName: zerodhaAdditionalPayload?.modelName || storeModalName,
        });
        portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
          userEmail,
          modelName: zerodhaAdditionalPayload?.modelName || storeModalName,
          broker: 'Zerodha',
        });

        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/user-portfolio`,
            { user_email: userEmail },
            { headers: requestHeaders }
          );

          const statusCheckData = {
            userEmail: userEmail,
            modelName: zerodhaAdditionalPayload.modelName,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Zerodha',
          };
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
            statusCheckData,
            { headers: requestHeaders }
          );
        } catch (error) {
          console.error('Error updating Zerodha portfolio:', error);
        }

        AsyncStorage.removeItem('stockDetailsZerodhaOrder');
        AsyncStorage.removeItem('zerodhaAdditionalPayload');
        // Cross-publisher cleanup — drop Fyers pending state too.
        AsyncStorage.removeItem('stockDetailsFyersOrder');
        getRebalanceRepair();
        getModelPortfolioStrategyDetails();
      } catch (error) {
        console.log('Error in checkZerodhaStatus:', error);
        console.log('Error response:', error.response?.data);
      }
    }
  };

  // Watch zerodhaStatus changes
  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        const { zerodhaStockDetails, zerodhaAdditionalPayload } =
          await fetchZerodhaData();
        if (
          zerodhaStatus !== null &&
          zerodhaAdditionalPayload !== null &&
          zerodhaStockDetails !== null &&
          zerodhaRequestType === 'rebalance' &&
          jwtToken !== undefined
        ) {
          checkZerodhaStatus();
        }
      } catch (error) {
        console.error('Error in fetchAndProcessData:', error);
      }
    };
    fetchAndProcessData();
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  // --- End Zerodha Publisher Flow Functions ---

  // --- Fyers Publisher Flow Functions ---

  const handleFyersRedirect = async () => {
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) {
      setOpenRebalanceModal(false);
      setTimeout(() => openBrokerModal(broker), 500);
      return;
    }

    setLoading(true);
    try {
      const currentISTDateTime = new Date();
      const istDatetime = moment(currentISTDateTime).format();

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      // Store stock details for post-processing.
      // Cross-publisher cleanup — also wipe Zerodha pending state.
      // Per SDK_ORCHESTRATION_AUDIT.md § Pass 2 / Suspected defect #3.
      await AsyncStorage.removeItem('stockDetailsFyersOrder');
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');
      await AsyncStorage.setItem(
        'stockDetailsFyersOrder',
        JSON.stringify(stockDetails),
      );

      // Record trade intent
      await axios.post(
        `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
        {
          stockDetails: stockDetails,
          leaving_datetime: currentISTDateTime,
          email: userEmail,
          trade_given_by: advisorTag,
        },
        { headers: requestHeaders },
      );

      // Place orders via Fyers API through process-trade.
      // Trade variant tagged on every per-trade object — see
      // docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field.
      const fyersVariant = computeTradeVariant(allowAfterHoursOrders);
      const payload = {
        clientId: clientCode,
        accessToken: jwtToken,
        user_email: userEmail,
        user_broker: 'Fyers',
        modelName: additionalPayload.modelName,
        advisor: additionalPayload.advisor,
        model_id: additionalPayload.model_id || modelPortfolioModelId,
        unique_id: additionalPayload.unique_id,
        returnDateTime: istDatetime,
        trades: stockDetails.map(stock => ({ ...stock, variant: fyersVariant })),
        caPendingInfo: calculatedPortfolioData?.caPendingInfo || [],
      };

      // SDK executeAdvice dual-path (Phase C) — Fyers publisher path.
      let checkData;
      if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResult = await sdkClient.executeAdvice(
            {
              kind: 'mpRebalance',
              clientAdviceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              brokerName: 'Fyers',
              modelId: additionalPayload.model_id || modelPortfolioModelId,
              modelName: additionalPayload.modelName,
              uniqueId: additionalPayload.unique_id,
              trades: payload.trades,
            },
            // skipReview + presentResult=false — host owns both UIs.
            { skipReview: true, presentResult: false },
          );
          // 2026-05-07: SDK now passes through ccxt's original
          // `orderStatus` / `errorCode` / `message_aq` /
          // `orderStatusMessage` / `tradingSymbol` via spread (see
          // AqSdkClient.ts Step 3). Previously we overwrote
          // `orderStatus: row.status` with the SDK enum, which
          // erased the broker-side rejection code (e.g. AB4036
          // cautionary listing) — RecommendationSuccessModal then
          // showed "All Orders Placed Successfully" for orders the
          // broker had actually rejected. Pass through unchanged.
          checkData = sdkResult?.rows || [];
          console.log('[RebalanceModal] SDK executeAdvice (Fyers) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
        } catch (sdkErr) {
          console.error('[RebalanceModal] SDK executeAdvice (Fyers) failed, falling back to legacy:', sdkErr?.message);
          checkData = null;
        }
      }

      if (!checkData) {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/process-trade`,
          payload,
          { headers: requestHeaders, timeout: 120000 },
        );
        checkData = response?.data?.results;
      }

      setOrderPlacementResponse(checkData);
      // Capture outgoing trade list (variant-tagged) so the success modal
      // can recover `variant` per row when ccxt-india doesn't echo it.
      setLastSubmittedTrades?.(payload.trades);

      // Handle TPIN rejection for Fyers sell orders — equity delivery only
      if (checkData && checkData.length > 0) {
        const eqSells = checkData.filter(s => {
          const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
          if (txnType !== 'SELL') return false;
          const exchange = (s.exchange || s.Exchange || '').toUpperCase();
          const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
          if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
          if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
          return true;
        });
        const allSell = eqSells.length > 0 && checkData.every(s => s.transactionType === 'SELL');
        const isMixed = eqSells.length > 0 && checkData.some(s => s.transactionType === 'BUY');
        const rejectedSellCount = checkData.reduce((count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        }, 0);
        const successCount = checkData.reduce((count, order) => {
          return isOrderSuccess(order?.orderStatus) &&
            (order.transactionType === 'SELL' || isMixed)
            ? count + 1
            : count;
        }, 0);

        if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          successCount === 0
        ) {
          setShowFyersTpinModal(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          return;
        }
      }

      setOpenSucessModal(true);
      setOpenRebalanceModal(false);
      eventEmitter.emit('OrderPlacedReferesh');

      // Update model portfolio DB
      const updateData = {
        modelId: modelPortfolioModelId,
        orderResults: checkData,
        userEmail: userEmail,
        modelName: filteredData[0]['model_name'],
      };
      await axios.post(
        `${server.server.baseUrl}api/model-portfolio-db-update`,
        updateData,
        { headers: requestHeaders },
      );

      // Update subscriber execution status (matching web app)
      if (checkData && checkData.length > 0) {
        const successStatuses = ['complete', 'executed', 'traded'];
        const pendingStatuses = ['open', 'pending', 'transit', 'placed', 'trigger pending', 'after market order req received'];
        const pubSuccessCount = checkData.filter(r =>
          successStatuses.includes((r.orderStatus || '').toLowerCase()),
        ).length;
        let executionStatus;
        if (pubSuccessCount === checkData.length) {
          executionStatus = 'executed';
        } else if (pubSuccessCount > 0) {
          executionStatus = 'partial';
        } else {
          const hasPendingOrders = checkData.some(r =>
            pendingStatuses.includes((r.orderStatus || '').toLowerCase()),
          );
          executionStatus = hasPendingOrders ? 'pending' : 'toExecute';
        }

        try {
          await axios.put(
            `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
            {
              userEmail: userEmail,
              modelName: filteredData[0]['model_name'],
              model_id: modelPortfolioModelId,
              executionStatus: executionStatus,
              user_broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
        } catch (err) {
          console.warn('[FyersPublisher] subscriber-execution update failed:', err);
        }

        // Record publisher results
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
            {
              modelName: filteredData[0]['model_name'],
              model_id: modelPortfolioModelId,
              unique_id: additionalPayload.unique_id,
              advisor: advisorTag,
              order_results: checkData,
              user_email: userEmail,
              user_broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
          console.log('[FyersPublisher] Successfully recorded publisher results');
        } catch (err) {
          console.warn('[FyersPublisher] record-publisher-results failed:', err);
        }
      }

      // Enroll in status-check-queue
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        {
          userEmail: userEmail,
          modelName: filteredData[0]['model_name'],
          advisor: advisorTag,
          broker: 'Fyers',
        },
        { headers: requestHeaders },
      );

      await AsyncStorage.removeItem('stockDetailsFyersOrder');
      // Cross-publisher cleanup — drop Zerodha pending state too.
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');

      // Emit structured portfolio events (matching prod)
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: filteredData[0]?.['model_name'] || storeModalName,
      });
      portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
        userEmail,
        modelName: filteredData[0]?.['model_name'] || storeModalName,
        broker: 'Fyers',
      });

      getRebalanceRepair();
      getModelPortfolioStrategyDetails();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('[FyersPublisher] Error:', error);

      let errorMessage;
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
        errorMessage =
          'Unable to connect to Fyers trading server. Please reconnect your broker and try again.';
      } else if (
        error?.response?.status === 401 ||
        error?.response?.status === 403
      ) {
        errorMessage =
          'Fyers session has expired. Please reconnect your broker and try again.';
      } else {
        errorMessage =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'Order placement failed';
      }

      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: errorMessage,
      });
      getModelPortfolioStrategyDetails();
    }
  };

  // --- End Fyers Publisher Flow Functions ---

  const placeOrder = async () => {
    console.log('[RebalanceModal] placeOrder called');
    console.log('[RebalanceModal] dataArray:', JSON.stringify(dataArray));
    console.log('[RebalanceModal] stockDetails:', JSON.stringify(stockDetails));
    console.log('[RebalanceModal] calculatedPortfolioData keys:', calculatedPortfolioData ? Object.keys(calculatedPortfolioData) : 'null');
    console.log('[RebalanceModal] calculatedPortfolioData buy:', JSON.stringify(calculatedPortfolioData?.buy));
    console.log('[RebalanceModal] calculatedPortfolioData sell:', JSON.stringify(calculatedPortfolioData?.sell));

    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) {
      // Open broker connection modal so user can re-authenticate
      setOpenRebalanceModal(false);
      setTimeout(() => openBrokerModal(broker), 500);
      return;
    }

    setLoading(true);

    // Pre-order EDIS checks — only for equity delivery (CNC) sells.
    // Derivatives (NFO/BFO/MIS/NRML) do NOT need EDIS/DDPI authorization.
    const equityDeliverySells = stockDetails?.filter(s => {
      const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
      if (txnType !== 'SELL') return false;
      const exchange = (s.exchange || s.Exchange || '').toUpperCase();
      const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
      if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
      if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
      return true;
    }) || [];
    const hasEquitySells = equityDeliverySells.length > 0;
    const allSellPre = hasEquitySells && stockDetails?.every(s => s.transactionType === 'SELL');
    const isMixedPre = hasEquitySells && stockDetails?.some(s => s.transactionType === 'BUY');

    if (broker === 'Dhan' && (allSellPre || isMixedPre) &&
      (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false))) {
      setShowDhanTpinModel(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    // If user has completed TPIN authorization or has active DDPI, proceed
    const canSellZerodha = isZerodhaSellAuthorized(userDetails);
    if (broker === 'Zerodha' && (allSellPre || isMixedPre) && !canSellZerodha) {
      setShowDdpiModal && setShowDdpiModal(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    if (broker === 'Angel One' && (allSellPre || isMixedPre) &&
      !userDetails?.ddpi_enabled &&
      !userDetails?.is_authorized_for_sell) {
      setShowAngleOneTpinModel(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    // Pre-order EDIS check for Fyers broker
    if (broker === 'Fyers' && (allSellPre || isMixedPre) &&
      !userDetails?.is_authorized_for_sell) {
      setShowFyersTpinModal(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    // AliceBlue / other brokers: check DB flag before placing sell orders
    // (AliceBlue has no EDIS API — relies on user authorizing at broker portal)
    if (['AliceBlue', 'IIFL Securities', 'ICICI Direct', 'Upstox', 'Kotak', 'Hdfc Securities', 'Motilal Oswal', 'Groww'].includes(broker) &&
      (allSellPre || isMixedPre) && !userDetails?.is_authorized_for_sell) {
      setShowOtherBrokerModel(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    // T+1 settlement heads-up. A rebalance that both SELLS and BUYS funds the
    // buys partly from today's sell proceeds, which (CNC equity) only fully
    // settle at T+1. So a few buys may not go through right now — that's
    // expected, and the fix is to re-run tomorrow, NOT to add more funds.
    // Mirrors the web BrokerPublisherButton notice (prod-alphaquark-github
    // 2026-06-30). Informational only — does not block the rebalance.
    if (isMixedPre) {
      Toast.show({
        type: 'info',
        text1: 'Some buys may complete tomorrow',
        text2:
          "Cash from today's sells settles tomorrow (T+1). If a few buys don't go through now, just re-run the rebalance tomorrow — you don't need to add more funds.",
        visibilityTime: 9000,
      });
    }

    const matchingRepairTrade =
      modelPortfolioRepairTrades &&
      modelPortfolioRepairTrades?.find(
        trade => trade.modelId === modelPortfolioModelId,
      );

    // Trade variant — `"AMO" | "REGULAR"`. Tagged on every per-trade
    // object at submit. See docs/APP_ARCHITECTURE.md § 4.5.2 Trade
    // variant field. Display-only — drives the amber AMO pill in
    // RecommendationSuccessModal. ccxt-india doesn't echo this field on
    // rebalance/process-trade; the success modal falls back to looking
    // it up against `originalStockDetails` (passed below).
    const variant = computeTradeVariant(allowAfterHoursOrders);
    const tradesWithVariant = stockDetails.map(stock => ({ ...stock, variant }));

    const getBasePayload = () => ({
      user_broker: broker,
      user_email: userEmail,
      trades: tradesWithVariant,
      model_id: modelPortfolioModelId,
    });

    const getBrokerSpecificPayload = () => {
      if (broker === 'AliceBlue') {
        return { clientId: clientCode, accessToken: jwtToken, apiKey: apiKey };
      } else if (broker === 'Upstox') {
        return { apiKey: defaultDecrypt(apiKey), apiSecret: defaultDecrypt(secretKey), accessToken: jwtToken };
      } else if (broker === 'Dhan') {
        return { clientId: clientCode, accessToken: jwtToken };
      } else if (broker === 'Angel One') {
        return { apiKey: angelOneApiKey, jwtToken: jwtToken };
      } else if (broker === 'IIFL Securities') {
        return { clientCode: clientCode };
      } else if (broker === 'ICICI Direct') {
        return { apiKey: defaultDecrypt(apiKey), secretKey: defaultDecrypt(secretKey), accessToken: jwtToken };
      } else if (broker === 'Hdfc Securities') {
        return { apiKey: defaultDecrypt(apiKey), accessToken: jwtToken };
      } else if (broker === 'Kotak') {
        // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
        return { consumerKey: defaultDecrypt(apiKey), accessToken: jwtToken, viewToken, sid, serverId };
      } else if (broker === 'Fyers') {
        return { clientId: clientCode, accessToken: jwtToken };
      } else if (broker === 'Motilal Oswal') {
        return { clientCode: clientCode, accessToken: jwtToken, apiKey: defaultDecrypt(apiKey) };
      } else if (broker === 'Groww') {
        return { accessToken: jwtToken };
      } else {
        return { accessToken: jwtToken };
      }
    };

    const getAdditionalPayload = () => {
      if (matchingRepairTrade) {
        return {
          modelName: matchingRepairTrade.modelName,
          advisor: advisorTag,
          unique_id: matchingRepairTrade?.uniqueId,
        };
      } else {
        return {
          modelName: filteredData[0]['model_name'],
          advisor: advisorTag,
          unique_id: calculatedPortfolioData?.uniqueId,
        };
      }
    };

    const payload = {
      ...getBasePayload(),
      ...getBrokerSpecificPayload(),
      ...getAdditionalPayload(),
      // Include CA pending info for partial trade recording (matching web)
      caPendingInfo: calculatedPortfolioData?.caPendingInfo || [],
    };

    console.log('[RebalanceModal] Final payload trades count:', payload.trades?.length);
    console.log('[RebalanceModal] Final payload:', JSON.stringify({
      user_broker: payload.user_broker,
      user_email: payload.user_email,
      model_id: payload.model_id,
      modelName: payload.modelName,
      unique_id: payload.unique_id,
      tradesCount: payload.trades?.length,
      trades: payload.trades,
    }));

    // Guard: Don't send empty trades to broker
    if (!payload.trades || payload.trades.length === 0) {
      console.warn('[RebalanceModal] ERROR: trades array is empty! Aborting order placement.');
      Toast.show({
        type: 'error',
        text1: 'No Trades to Execute',
        text2: 'The trade list is empty. Please go back and try again.',
      });
      setLoading(false);
      return;
    }

    const specialBrokers = [
      'IIFL Securities',
      'ICICI Direct',
      'Upstox',
      'Kotak',
      'Hdfc Securities',
      'AliceBlue',
      'Motilal Oswal',
      'Groww',
    ];

    const config = {
      method: 'post',
      url: `${server.ccxtServer.baseUrl}rebalance/process-trade`,
      timeout: 120000,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: JSON.stringify(payload),
    };

    // SDK executeAdvice dual-path (Phase C) — main broker path.
    // When SDK is enabled, try the SDK orchestrator first. On failure,
    // fall through to the legacy axios path. The SDK result is wrapped
    // in a response-shaped object so the downstream .then() handler
    // works unchanged.
    let sdkResponse = null;
    if (sdkExecuteAdviceEnabled) {
      try {
        const sdkResult = await sdkClient.executeAdvice(
          {
            kind: 'mpRebalance',
            clientAdviceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            brokerName: broker,
            modelId: payload.model_id,
            modelName: payload.modelName,
            uniqueId: payload.unique_id,
            trades: payload.trades,
          },
          // 2026-05-07:
          // - skipReview=true: RebalanceModal Step 3 already shows
          //   the trade list + Note + Place Order button — SDK
          //   review sheet would be a redundant second confirmation.
          // - presentResult=false: legacy RecommendationSuccessModal
          //   (rendered by RebalanceAdvices on order completion)
          //   already shows the per-row success/failure breakdown +
          //   cautionary-listing banner + manual-placement guidance.
          //   Letting the SDK ALSO render its TradeResultModal stacks
          //   two result UIs and leaves a phantom Modal-window white
          //   patch on the left edge that intercepts touches (the
          //   SDK overlay's `phase: 'result'` never transitions back
          //   to `idle` once the result fires, so the Modal stays
          //   mounted indefinitely).
          { skipReview: true, presentResult: false },
        );
        // 2026-05-07: pass through SDK rows verbatim. The SDK now
        // preserves ccxt's original `orderStatus` / `errorCode` /
        // `message_aq` / `tradingSymbol` via spread, so frontend
        // utilities (orderStatusUtils.normalizeOrderStatus, the
        // cautionary-listing detection in RecommendationSuccessModal,
        // etc.) consume the broker-flavoured fields directly — same
        // code path as the legacy axios flow, no second translation.
        sdkResponse = { data: { results: sdkResult?.rows || [] } };
        console.log('[RebalanceModal] SDK executeAdvice (main) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
      } catch (sdkErr) {
        console.error('[RebalanceModal] SDK executeAdvice (main) failed, falling back to legacy:', sdkErr?.message);
      }
    }

    await (sdkResponse ? Promise.resolve(sdkResponse) : axios.request(config))
      .then(async response => {
        const checkData = response?.data?.results;
        console.log('[RebalanceModal] process-trade response:', JSON.stringify({
          resultsCount: checkData?.length,
          status: response?.data?.status,
          message: response?.data?.message,
          error: response?.data?.error,
        }));
        setOrderPlacementResponse(response?.data?.results);
        setLastSubmittedTrades?.(tradesWithVariant);

        // Handle session expired - broker needs reconnection
        if (response?.data?.sessionExpired) {
          setOpenRebalanceModal(false);
          setLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: `Your ${broker} session has expired. Please reconnect your broker.`,
            visibilityTime: 5000,
          });
          // Open broker connection modal so user can re-authenticate
          setTimeout(() => {
            openBrokerModal(broker);
          }, 500);
          return;
        }

        // Guard: If backend returned empty results, check for cautionary listing or show error
        if (!checkData || checkData.length === 0) {
          const errorMsg = response?.data?.message || response?.data?.error || '';
          const isCautionaryError = errorMsg.toLowerCase().includes('cautionary') && errorMsg.toLowerCase().includes('listing');
          console.warn('[RebalanceModal] Empty results from process-trade:', errorMsg, 'isCautionary:', isCautionaryError);

          if (isCautionaryError) {
            const syntheticResults = (payload.trades || []).map(trade => ({
              symbol: trade.tradingSymbol || trade.symbol || trade.Trading_Symbol || '',
              searchSymbol: trade.tradingSymbol || trade.symbol || '',
              transactionType: trade.transactionType || trade.transaction_type || 'BUY',
              quantity: trade.quantity || trade.qty || 0,
              orderType: trade.orderType || trade.order_type || 'MARKET',
              exchange: trade.exchange || 'NSE',
              orderStatus: 'REJECTED',
              orderStatusMessage: errorMsg,
              message_aq: errorMsg,
              // Carry variant through synthetic-rejection rendering too.
              variant: trade.variant || 'REGULAR',
            }));
            setOrderPlacementResponse(syntheticResults);
            setLastSubmittedTrades?.(payload.trades);
            setOpenRebalanceModal(false);
            setLoading(false);
            setOpenSucessModal(true);
            getModelPortfolioStrategyDetails();
            return;
          }

          // Show TPIN modal for all brokers when sell orders return empty response
          if (allSellPre || isMixedPre) {
            if (broker === 'Dhan') {
              setShowDhanTpinModel(true);
            } else if (broker === 'Angel One') {
              setShowAngleOneTpinModel(true);
            } else if (broker === 'Zerodha') {
              setShowDdpiModal && setShowDdpiModal(true);
            } else if (broker === 'Fyers') {
              setShowFyersTpinModal(true);
            } else {
              setShowOtherBrokerModel(true);
            }
            setOpenRebalanceModal(false);
            setLoading(false);
            return;
          }

          // Non-sell empty results: show error toast
          Toast.show({
            type: 'error',
            text1: 'Order Processing Failed',
            text2: errorMsg || 'No orders were processed by the broker. Please try again.',
            visibilityTime: 5000,
          });
          setOpenRebalanceModal(false);
          setLoading(false);
          getModelPortfolioStrategyDetails();
          return;
        }

        // Equity delivery sells only — derivatives don't need EDIS/DDPI
        const eqSellsPost = (checkData || []).filter(s => {
          const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
          if (txnType !== 'SELL') return false;
          const exchange = (s.exchange || s.Exchange || '').toUpperCase();
          const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
          if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
          if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
          return true;
        });
        const isMixed = eqSellsPost.length > 0 && checkData?.some(stock => stock.transactionType === 'BUY');
        const allBuy = checkData?.every(stock => stock.transactionType === 'BUY');
        const allSell = eqSellsPost.length > 0 && checkData?.every(stock => stock.transactionType === 'SELL');

        const rejectedSellCount = (checkData || []).reduce(
          (count, order) => {
            return isOrderRejected(order?.orderStatus) &&
              order.transactionType === 'SELL'
              ? count + 1
              : count;
          },
          0,
        );

        const successCount = (checkData || []).reduce((count, order) => {
          return isOrderSuccess(order?.orderStatus) &&
            (order.transactionType === 'SELL' || isMixed)
            ? count + 1
            : count;
        }, 0);

        // Detect all orders failed with rich error data from backend (matching web)
        const backendOrderErrors = response?.data?.orderErrors || [];
        const backendFundsRequired = response?.data?.fundsRequired;
        const allOrdersFailed = (checkData || []).every(order => {
          const s = (order?.orderStatus || '').toUpperCase();
          return s === 'REJECTED' || s === 'CANCELLED' || s === 'FAILURE' || s === 'FAILED';
        });

        // Transient service-window short-circuit: if every failed row is a
        // known broker maintenance-window error (e.g. Upstox UDAPI100074
        // between 00:00–05:30 IST), show a soft toast and close the modal
        // instead of the all-failed modal. Broker session is fine — just
        // retry after the window reopens.
        const transientServiceWindowMsg = detectTransientOrderWindowError(response?.data);
        if (transientServiceWindowMsg) {
          Toast.show({
            type: 'info',
            text1: 'Broker service window',
            text2:
              transientServiceWindowMsg ||
              `${broker} order placement is temporarily unavailable. Try again during the broker's service hours.`,
            visibilityTime: 8000,
          });
          setOpenRebalanceModal(false);
          setLoading(false);
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        if (allOrdersFailed && backendOrderErrors.length > 0) {
          // Show success modal with failure details (matches web behavior)
          setOrderPlacementResponse(checkData);
          setLastSubmittedTrades?.(tradesWithVariant);
          setOpenSucessModal(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          if (backendFundsRequired) {
            Toast.show({
              type: 'error',
              text1: 'Insufficient Funds',
              text2: `Amount needed: \u20B9${parseFloat(backendFundsRequired).toFixed(2)}. Please add funds and retry.`,
              visibilityTime: 6000,
            });
          }
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        // Check for CDSL/EDIS/TPIN error messages in rejected orders
        const hasCdslError = (checkData || []).some((order) => {
          const msg = (order?.orderStatusMessage || order?.message_aq || order?.message || "").toLowerCase();
          return msg.includes("cdsl") || msg.includes("edis") || msg.includes("tpin") || msg.includes("validate qty");
        });

        // Check for cautionary listing rejections - these should bypass TPIN/EDIS modals
        const hasCautionaryRejection = (checkData || []).some((order) => {
          const msg = (order?.orderStatusMessage || order?.message_aq || order?.message || "").toLowerCase();
          return msg.includes("cautionary") && msg.includes("listing");
        });

        // If cautionary listing rejection, go directly to success modal to show the alert
        if (hasCautionaryRejection) {
          setOpenSucessModal(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          // Still do db update and status check
          try {
            await axios.post(
              `${server.server.baseUrl}api/model-portfolio-db-update`,
              {
                modelId: modelPortfolioModelId,
                orderResults: checkData,
                userEmail: userEmail,
                modelName: filteredData[0]['model_name'],
              },
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
          } catch (dbErr) {
            console.warn('Error updating db after cautionary rejection:', dbErr);
          }
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        // Dhan: Check CDSL error messages first
        if (
          broker === 'Dhan' &&
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          hasCdslError
        ) {
          setShowDhanTpinModel(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          return;
        }

        if (
          !isReturningFromOtherBrokerModal &&
          specialBrokers.includes(broker)
        ) {
          if (allBuy) {
            setOpenSucessModal(true);
            setOpenRebalanceModal(false);
          } else if (
            (allSell || isMixed) &&
            rejectedSellCount >= 1 &&
            successCount === 0
          ) {
            setShowOtherBrokerModel(true);
            setOpenRebalanceModal(false);
            setLoading(false);
            return;
          } else {
            setOpenSucessModal(true);
            setOpenRebalanceModal(false);
          }
        } else if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1
        ) {
          // Always show broker-specific TPIN modal for rejected sell orders
          // Don't rely on CDSL keyword detection - error message formats can change
          setOpenSucessModal(false);
          setLoading(false);
          setOpenRebalanceModal(false);

          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          return;
        } else {
          setOpenSucessModal(true);
          setOpenRebalanceModal(false);
        }

        getRebalanceRepair();
        const updateData = {
          modelId: modelPortfolioModelId,
          orderResults: checkData,
          userEmail: userEmail,
          modelName: filteredData[0]['model_name'],
        };

        return axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          updateData,
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
      })
      .then(() => {
        // Add user to status check queue for async order status polling (matching web frontend)
        const statusCheckData = {
          userEmail: userEmail,
          modelName: filteredData[0]['model_name'],
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          broker: broker,
        };
        return axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          statusCheckData,
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
      })
      .then(() => {
        setLoading(false);
        setOpenRebalanceModal(false);

        // Emit structured portfolio events (matching prod)
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
          userEmail,
          modelName: filteredData[0]?.['model_name'] || storeModalName,
        });
        portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
          userEmail,
          modelName: filteredData[0]?.['model_name'] || storeModalName,
          broker,
        });

        getModelPortfolioStrategyDetails();
      })
      .catch(error => {
        setLoading(false);

        // Determine a user-friendly error message
        let errorMessage;
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
          errorMessage = `Unable to connect to ${broker} trading server. This could be due to broker session expiry or a temporary server issue. Please reconnect your broker and try again.`;
        } else if (error?.response?.status === 401 || error?.response?.status === 403) {
          errorMessage = `${broker} session has expired. Please reconnect your broker.`;
          // Open broker connection modal so user can re-authenticate
          setOpenRebalanceModal(false);
          setTimeout(() => {
            openBrokerModal(broker);
          }, 500);
        } else {
          errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Order placement failed';
        }

        // Show TPIN modal for all brokers when sell orders fail
        // Don't rely on CDSL keyword detection - error message formats can change
        if (allSellPre || isMixedPre) {
          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          setOpenRebalanceModal(false);
          return;
        }

        Toast.show({
          type: 'error',
          text1: 'Order Failed',
          text2: errorMessage,
        });
        getModelPortfolioStrategyDetails();
      });
    setIsReturningFromOtherBrokerModal(false);
  };

  const handleClose = () => {
    setWebView(false);
    setOpenRebalanceModal(false);
  };

  const onSlideComplete = () => {
    if (broker === 'Zerodha') {
      handleZerodhaRedirect();
    } else if (broker === 'Fyers') {
      handleFyersRedirect();
    } else {
      placeOrder();
    }
  };

  // `allowAfterHoursOrders` is destructured at the top of the component
  // body — single source of truth (see comment at top).
  const marketGateOpen = IsMarketHours() || allowAfterHoursOrders;

  const ListItem = React.memo(
    ({
      item,
      index,
      isBrokerDisconnected,
      handlePriceSave,
      handleQtySave,
      getLTPForSymbol,
      // Repair-mode props — see § 6g
      isRepairMode,
      promptMarkAsManuallyPlaced,
      manualPlacementInFlight,
      manuallyPlacedSymbols,
    }) => {
      // 🧠 Local state for TextInput values
      const [localPrice, setLocalPrice] = React.useState(
        item.editablePrice?.toString() ?? '',
      );
      const [localQty, setLocalQty] = React.useState(
        item.editableQty?.toString() ?? '',
      );

      const displayPrice = isBrokerDisconnected
        ? localPrice
        : getLTPForSymbol(item.symbol)?.toString() ?? '0';

      const displayQuantity = isBrokerDisconnected
        ? localQty
        : item.qty?.toString() ?? '0';

      // Classify the row for the chip. Cautionary takes precedence over
      // LOW_FUNDS in the chip copy — cautionary requires placing manually
      // by definition, whereas LOW_FUNDS may be transient (user adds
      // funds → retry succeeds).
      const isCautionary = isRepairMode && isCautionaryListingMessage(item);
      const isLowFunds =
        isRepairMode && !isCautionary && isInsufficientFundsMessage(item);
      const isPartialFill = isRepairMode && item.isPartialFill;
      const showChip = isCautionary || isLowFunds || isPartialFill;
      const isThisRowSubmitting = manualPlacementInFlight === item.symbol;
      const isAlreadyMarked = !!manuallyPlacedSymbols?.[item.symbol];

      const chipLabel = isAlreadyMarked
        ? 'Marked as placed ✓'
        : isCautionary
        ? 'Cautionary listing — place manually'
        : isLowFunds
        ? 'Insufficient funds last time'
        : isPartialFill
        ? `Partial fill last time (${item.filledQty}/${item.originalQty})`
        : '';

      const chipStyle = isAlreadyMarked
        ? styles.chipDone
        : isCautionary
        ? styles.chipCautionary
        : isLowFunds
        ? styles.chipLowFunds
        : styles.chipPartial;

      return (
        <View style={styles.rowContainer}>
          <View style={{flex: 1}}>
            <View style={styles.leftContainer}>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text
                style={[
                  styles.cellText,
                  item.orderType === 'BUY' ? styles.buyOrder : styles.sellOrder,
                ]}>
                {item.orderType}
              </Text>
            </View>
            {showChip && (
              <TouchableOpacity
                onPress={
                  isAlreadyMarked || isThisRowSubmitting
                    ? undefined
                    : () => promptMarkAsManuallyPlaced(item)
                }
                disabled={isAlreadyMarked || isThisRowSubmitting}
                activeOpacity={isAlreadyMarked ? 1 : 0.6}
                style={[styles.chipBase, chipStyle]}>
                {isThisRowSubmitting ? (
                  <ActivityIndicator size="small" color="#9A3412" />
                ) : (
                  <>
                    {!isAlreadyMarked && <AlertTriangle size={11} color="#9A3412" />}
                    <Text
                      style={[
                        styles.chipText,
                        isAlreadyMarked && styles.chipTextDone,
                      ]}>
                      {chipLabel}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.rightContainer}>
            {isBrokerDisconnected ? (
              <TextInput
                style={styles.quantityInput}
                value={displayPrice}
                onChangeText={setLocalPrice} // only local change
                onEndEditing={() => handlePriceSave(index, localPrice)} // save to parent once done
                keyboardType="numeric"
                placeholder="Price"
                returnKeyType="done"
                blurOnSubmit={false}
              />
            ) : (
              <Text style={styles.qty}>{displayPrice}</Text>
            )}
          </View>

          <View style={styles.rightContainer}>
            {isBrokerDisconnected ? (
              <TextInput
                style={styles.quantityInput}
                value={displayQuantity}
                onChangeText={setLocalQty}
                onEndEditing={() => handleQtySave(index, localQty)}
                keyboardType="numeric"
                placeholder="Qty"
                returnKeyType="done"
                blurOnSubmit={false}
              />
            ) : (
              <Text style={styles.qty}>{item.qty}</Text>
            )}
          </View>
        </View>
      );
    },
  );

  const renderListItem = useCallback(
    ({ item, index }) => (
      <ListItem
        item={item}
        index={index}
        isBrokerDisconnected={isBrokerDisconnected}
        handlePriceSave={handlePriceSave}
        handleQtySave={handleQtySave}
        getLTPForSymbol={getLTPForSymbol}
        isRepairMode={isRepairMode}
        promptMarkAsManuallyPlaced={promptMarkAsManuallyPlaced}
        manualPlacementInFlight={manualPlacementInFlight}
        manuallyPlacedSymbols={manuallyPlacedSymbols}
      />
    ),
    [
      isBrokerDisconnected,
      handlePriceSave,
      handleQtySave,
      getLTPForSymbol,
      isRepairMode,
      promptMarkAsManuallyPlaced,
      manualPlacementInFlight,
      manuallyPlacedSymbols,
    ],
  );

  const debouncedHandlePriceSave = useCallback(
    debounce((index, price) => {
      setEditableData(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, editablePrice: price } : item,
        ),
      );
    }, 300),
    [],
  );

  const debouncedHandleQtySave = useCallback(
    debounce((index, qty) => {
      setEditableData(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, editableQty: qty } : item,
        ),
      );
    }, 300),
    [],
  );

  const handlePriceSave = (index, price) => {
    debouncedHandlePriceSave(index, parseFloat(price) || 0);
  };

  const handleQtySave = (index, qty) => {
    debouncedHandleQtySave(index, parseInt(qty) || 0);
  };

  // Mark a repair-mode row as manually placed. Calls aq_backend's
  // /api/model-portfolio-db-update/manual-placement so the manager's
  // model_portfolio.rebalanceHistory[].adviceEntries[].status flips to
  // "executed" + manually_placed_at is stamped, then mutates the local
  // dataArray to remove the row visually. Mirrors mobile MP success
  // modal's per-row editor (RecommendationSuccessModal.js:290) but
  // skips the qty/price input — we use the failed-trade's reported
  // quantity and the current LTP since the user has presumably placed
  // the same order via their broker app.
  // See docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
  const [manuallyPlacedSymbols, setManuallyPlacedSymbols] = useState({});
  const [manualPlacementInFlight, setManualPlacementInFlight] = useState(null);
  const markRowAsManuallyPlaced = useCallback(
    async item => {
      if (!modelPortfolioModelId || !item?.symbol) {
        Toast.show({
          type: 'error',
          text1: 'Cannot record placement',
          text2: 'Missing rebalance reference. Please retry from the portfolio.',
          visibilityTime: 4000,
        });
        return;
      }
      try {
        setManualPlacementInFlight(item.symbol);
        const ltp = getLTPForSymbol(item.symbol);
        await axios.put(
          `${server.server.baseUrl}api/model-portfolio-db-update/manual-placement`,
          {
            userEmail,
            modelId: modelPortfolioModelId,
            modelName: storeModalName,
            user_broker: broker || 'DummyBroker',
            symbol: item.symbol,
            exchange: item.exchange,
            transactionType: item.orderType,
            actualQty: Number(item.qty),
            actualPrice: Number.isFinite(ltp) && ltp > 0 ? Number(ltp) : null,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain':
                configData?.config?.REACT_APP_HEADER_NAME ||
                configData?.subdomain ||
                getAdvisorSubdomain(),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        setManuallyPlacedSymbols(prev => ({...prev, [item.symbol]: true}));
        // Refresh the repair list so the row vanishes on next render.
        if (typeof getRebalanceRepair === 'function') {
          getRebalanceRepair();
        }
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
          userEmail,
          modelName: storeModalName,
          broker,
        });
        Toast.show({
          type: 'success',
          text1: 'Marked as placed',
          text2: `${item.symbol} recorded as manually placed.`,
          visibilityTime: 3000,
        });
      } catch (e) {
        console.error(
          '[RebalanceModal manual-placement] error:',
          e?.response?.data || e?.message,
        );
        Toast.show({
          type: 'error',
          text1: 'Could not save',
          text2:
            e?.response?.data?.message ||
            e?.message ||
            'Try again in a moment.',
          visibilityTime: 4000,
        });
      } finally {
        setManualPlacementInFlight(null);
      }
    },
    [
      modelPortfolioModelId,
      userEmail,
      storeModalName,
      broker,
      configData,
      getLTPForSymbol,
      getRebalanceRepair,
    ],
  );

  // Tap handler for the cautionary / insufficient-funds chip. Two-step
  // confirm so a fat-finger tap doesn't silently flip the row.
  const promptMarkAsManuallyPlaced = useCallback(
    item => {
      const isCautionary = isCautionaryListingMessage(item);
      const reason = isCautionary
        ? 'Cautionary listing — this stock cannot be auto-placed.'
        : isInsufficientFundsMessage(item)
        ? 'Insufficient funds when last attempted.'
        : 'Order was rejected on the last attempt.';
      Alert.alert(
        `${item.symbol} · ${item.orderType}`,
        `${reason}\n\nPlace this order via your broker app first, then tap "Mark as Placed" to record it. Quantity ${item.qty} @ current LTP will be saved.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Mark as Placed',
            style: 'default',
            onPress: () => markRowAsManuallyPlaced(item),
          },
        ],
      );
    },
    [markRowAsManuallyPlaced],
  );

  return (
    <Modal transparent={true} visible={visible} onRequestClose={handleClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { width: width * 1 }]}>
          {webView ? (
            <View style={{ flex: 1, backgroundColor: 'white', padding: 10 }}>
              <View style={{ alignContent: 'flex-end', alignItems: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => setWebView(false)}
                  style={styles.closeButton}>
                  <XIcon size={24} color="#000" />
                </TouchableOpacity>
              </View>
              <WebView
                ref={webViewRef}
                style={{ flex: 1 }}
                source={{
                  html: htmlContent,
                  baseUrl: getPublisherWebViewBaseUrl(configData),
                }}
                onNavigationStateChange={handleWebViewNavigationStateChange}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onError={e => console.error('WebView error:', e.nativeEvent)}
              />
            </View>
          ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={isBrokerDisconnected ? editableData : dataArray}
              keyExtractor={item => item.symbol}
              renderItem={renderListItem}
              // ✅ This is CRUCIAL — prevents full re-render on typing
              extraData={editableData}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              contentContainerStyle={{
                paddingBottom: 90,
              }}
              // ✅ HEADER COMPONENT (all top section)
              ListHeaderComponent={
                <>
                  {/* Header bar */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingTop: 20,
                      justifyContent: 'space-between',
                    }}>
                    <Text></Text>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={styles.closeButton}>
                      <XIcon size={24} color="#000" />
                    </TouchableOpacity>
                  </View>

                  {/* Step progress bar */}
                  {currentStep === 3 && (
                    <View style={styles.progressBarContainer}>
                      <StepProgressBar
                        steps={stepsData}
                        currentStep={currentStep}
                      />
                    </View>
                  )}

                  <View style={{ borderColor: '#E8E8E8', marginTop: 5 }} />

                  {/* Skipped Stocks Warning */}
                  {hasSkippedStocks && (
                    <View style={styles.warningContainer}>
                      <View style={styles.warningHeader}>
                        <AlertOctagon size={20} color="#D97706" />
                        <Text style={styles.warningTitle}>
                          Stocks Skipped Due to Low Balance
                        </Text>
                      </View>
                      <Text style={styles.warningText}>
                        Following stocks could not be considered in the allocation
                        as balance allocated to the portfolio is close to or lower than minimum investment required:
                      </Text>
                      <View style={styles.skippedStocksList}>
                        {skippedStocksList?.map((stock, idx) => (
                          <Text key={idx} style={styles.skippedStockItem}>
                            • {stock}
                          </Text>
                        ))}
                      </View>
                      {minInvestment && (
                        <Text style={styles.minInvestmentText}>
                          Recommended Minimum Investment: ₹
                          {parseFloat(minInvestment).toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* CA Pending Info Warning (split settlement) */}
                  {calculatedPortfolioData?.caPendingInfo?.length > 0 && (
                    <View style={[styles.warningContainer, {borderLeftColor: '#F97316', borderLeftWidth: 4, backgroundColor: '#FFF7ED'}]}>
                      <View style={styles.warningHeader}>
                        <Text style={{fontSize: 14}}>⏳</Text>
                        <Text style={[styles.warningTitle, {color: '#9A3412'}]}>
                          Split Settlement Pending
                        </Text>
                      </View>
                      <Text style={[styles.warningText, {color: '#9A3412'}]}>
                        The following stocks have a recent split, but your broker hasn't credited all shares yet.
                      </Text>
                      {calculatedPortfolioData.caPendingInfo.map((item, index) => (
                        <View key={`ca-${index}`} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: index < calculatedPortfolioData.caPendingInfo.length - 1 ? 1 : 0, borderBottomColor: '#FED7AA'}}>
                          <Text style={{fontSize: 12, fontFamily: 'Poppins-Medium', color: '#9A3412', flex: 1}}>{item.symbol}</Text>
                          <Text style={{fontSize: 11, color: '#EA580C', flex: 1, textAlign: 'center'}}>Expected: {item.expected_qty}</Text>
                          <Text style={{fontSize: 11, color: '#16A34A', flex: 1, textAlign: 'right'}}>Can sell: {item.sell_qty_possible}</Text>
                        </View>
                      ))}
                      <Text style={{fontSize: 10, color: '#EA580C', marginTop: 8, fontFamily: 'Poppins-Regular'}}>
                        We'll sell {calculatedPortfolioData.caPendingInfo.reduce((sum, item) => sum + (item.sell_qty_possible || 0), 0)} shares now. The remaining will be marked for "Repair" — you can sell them once your broker credits the split shares.
                      </Text>
                    </View>
                  )}

                  {/* Header row */}
                  {!(dataArray.length === 0) && (
                    <View
                      style={[
                        styles.rowContainerhead,
                        {
                          backgroundColor: '#fff',
                          paddingVertical: 8,
                          borderRadius: 8,
                          marginHorizontal: 20,
                          marginBottom: 10,
                        },
                      ]}>
                      <View style={styles.leftContainerhead}>
                        <Text style={styles.headerTexthead}>Stocks</Text>
                      </View>
                      <View style={styles.rightContainerhead}>
                        <Text style={styles.headerTexthead}>
                          {isBrokerDisconnected ? 'Price' : 'Current Price'}
                        </Text>
                      </View>
                      <View style={styles.quantityContainerhead}>
                        <Text style={styles.headerTexthead}>Quantity</Text>
                      </View>
                    </View>
                  )}
                </>
              }
              // Empty state — Portfolio Already Aligned or API error message
              ListEmptyComponent={
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 40,
                    paddingHorizontal: 24,
                  }}>
                  {calculatedPortfolioData?.status === 1 && calculatedPortfolioData?.message ? (
                    <>
                      {/* Error/warning icon */}
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: '#FEF3C7',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 20,
                        }}>
                        <AlertOctagon size={36} color="#D97706" />
                      </View>
                      <Text
                        style={{
                          fontFamily: 'Poppins-SemiBold',
                          color: '#D97706',
                          fontSize: 18,
                          textAlign: 'center',
                          marginBottom: 12,
                        }}>
                        Unable to Rebalance
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Poppins-Regular',
                          color: 'rgba(0,0,0,0.6)',
                          textAlign: 'center',
                          marginBottom: 24,
                          fontSize: 14,
                          lineHeight: 22,
                          paddingHorizontal: 10,
                        }}>
                        {calculatedPortfolioData.message}
                      </Text>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={{
                          backgroundColor: '#000',
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 8,
                        }}>
                        <Text
                          style={{
                            color: '#fff',
                            fontFamily: 'Poppins-Medium',
                            fontSize: 14,
                          }}>
                          Go Back
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* Green checkmark circle */}
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: '#DEF7EC',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 20,
                        }}>
                        <CheckIcon size={36} color="#15803D" />
                      </View>
                      <Text
                        style={{
                          fontFamily: 'Poppins-SemiBold',
                          color: '#15803D',
                          fontSize: 20,
                          textAlign: 'center',
                          marginBottom: 12,
                        }}>
                        Your Portfolio is Already Aligned!
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Poppins-Regular',
                          color: 'rgba(0,0,0,0.6)',
                          textAlign: 'center',
                          marginBottom: 10,
                          fontSize: 14,
                          lineHeight: 22,
                          paddingHorizontal: 10,
                        }}>
                        Great news! Based on your current holdings and the latest model
                        portfolio recommendations, no trades are needed right now. Your
                        investments are already in sync with your manager's strategy.
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Poppins-Regular',
                          color: 'rgba(0,0,0,0.4)',
                          textAlign: 'center',
                          marginBottom: 24,
                          fontSize: 13,
                          lineHeight: 20,
                        }}>
                        Want to increase your investment or make changes? Go back and
                        modify your investment amount.
                      </Text>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={{
                          backgroundColor: '#000',
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 8,
                        }}>
                        <Text
                          style={{
                            color: '#fff',
                            fontFamily: 'Poppins-Medium',
                            fontSize: 14,
                          }}>
                          Go Back
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              }
            />
            {dataArray.length > 0 && (
            <View
              style={[
                styles.notecontainer,
                { marginHorizontal: 20, marginTop: 10 },
              ]}>
              <Text style={styles.noteTitle}>Note:</Text>
              <Text style={styles.noteText}>
                You will require a balance of{' '}
                {isBrokerDisconnected ? (
                  `₹${calculateRequiredFund().toFixed(2)}`
                ) : (
                  <TotalAmountTextRebalance
                    stockDetails={dataArray}
                    type={'reviewTrade'}
                    textStyle={{
                      fontFamily: 'Poppins-Regular',
                      fontSize: 12,
                      color: '#333',
                    }}
                  />
                )}{' '}
                in your broker. Please execute these transactions. If you confirm,
                we will record these transactions as EXECUTED.
              </Text>
            </View>
            )}

            {/* Action buttons */}
            {dataArray.length > 0 && (
              <>
                {isBrokerDisconnected ? (
                  <View
                    style={[
                      styles.brokerDisconnectedFooter,
                      { marginHorizontal: 20 },
                    ]}>
                    <View style={styles.fundsContainer}>
                      <View style={styles.fundItem}>
                        <Text style={styles.fundLabel}>Required Fund</Text>
                        <Text style={styles.fundValue}>
                          ₹{calculateRequiredFund().toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={openDummyBrokerConfirmation}
                      style={styles.confirmButton}>
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={onSlideComplete}
                    style={[
                      styles.nextStepButton,
                      (!marketGateOpen || loading) && styles.buttonDisabled,
                      loading && styles.buttonLoading,
                    ]}
                    disabled={!marketGateOpen || loading}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.nextStepButtonText}>
                        {!marketGateOpen ? 'Market is Closed' : 'Place Order'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Loading overlay */}
            {loading && (
              <ActivityIndicator
                size="small"
                color="#ffffff"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              />
            )}
          </View>
          )}
        </View>
      </SafeAreaView>

      {/* NEW: DummyBroker Confirmation Modal */}
      <DummyBrokerHoldingConfirmation
        userEmail={userEmail}
        isOpen={showDummyBrokerModal}
        onClose={closeDummyBrokerConfirmation}
        dummyBrokerConfirmationStockDetails={editableData}
        storeModalName={storeModalName}
        modelObjectId={modelPortfolioModelId}
        modelPortfolioModelId={modelPortfolioModelId}
        getModelPortfolioStrategyDetails={getModelPortfolioStrategyDetails}
        setOpenRebalanceModal={setOpenRebalanceModal}
        getRebalanceRepair={getRebalanceRepair}
        modelPortfolioRepairTrades={modelPortfolioRepairTrades}
        dummyBrokerCalculatedUniqueId={
          matchingRepairTrade?.uniqueId || calculatedPortfolioData?.uniqueId
        }
      />
      <Modal transparent visible={showPriceErrorModal} animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 20,
          }}>
          <View
            style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 8,
              width: '100%',
              maxWidth: 300,
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 14,
                marginBottom: 12,
                textAlign: 'center',
                color: '#000000',
              }}>
              Buying Price cannot be "Zero" Kindly enter your correct Buying
              Price to confirm
            </Text>
            <TouchableOpacity
              onPress={() => setShowPriceErrorModal(false)}
              style={{
                backgroundColor: '#0056B7',
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 5,
              }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Repair-mode chip on individual trade rows. See § 6g.
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
    color: '#9A3412',
  },
  chipTextDone: {
    color: '#166534',
  },
  // Cautionary listing — yellow/amber to match RecommendationSuccessModal.
  chipCautionary: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  // Insufficient funds last time — softer red.
  chipLowFunds: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  // Partial fill last time — neutral gray-amber.
  chipPartial: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  // Once user has marked the row manually placed.
  chipDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  notecontainer: {
    borderWidth: 1,
    borderColor: '#F9A825',
    borderRadius: 8,
    padding: 12,
    margin: 16,
    backgroundColor: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#7f9cbf',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9A825',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
  noteAmountText: {
    fontWeight: '600',
    color: '#0056B7',
  },

  // NEW: Broker disconnected styles

  brokerDisconnectedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fundsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fundItem: {
    flexDirection: 'column',
  },
  fundLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  fundValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },

  confirmButton: {
    backgroundColor: '#0056B7',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  rowContainerhead: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  nextStepButton: {
    backgroundColor: '#0056B7',
    marginHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  leftContainerhead: {
    flex: 1,
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
  },
  rightContainerhead: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityContainerhead: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexthead: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  // NEW: Styles for warning message and skipped stocks
  warningContainer: {
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 12,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 14,
    color: '#D97706',
    marginLeft: 8,
  },
  warningText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 13,
    color: '#92400E',
    marginBottom: 8,
  },
  skippedStocksList: {
    marginLeft: 4,
    marginBottom: 8,
  },
  skippedStockItem: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
    color: '#B45309',
    marginBottom: 2,
  },
  minInvestmentText: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 13,
    color: '#D97706',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    marginLeft: 0,
    flex: 1,
  },

  buyOrder: {
    color: '#0056B7',
    alignSelf: 'flex-start',
  },
  sellOrder: {
    color: 'red',
  },
  cell: {
    borderWidth: 1,
    borderColor: 'grey',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  symbol: {
    alignSelf: 'flex-start',
    color: 'black',
    flexDirection: 'column',
    fontFamily: 'Poppins-Medium',
  },
  qty: {
    alignSelf: 'center',
    color: 'black',
    flexDirection: 'column',
    fontFamily: 'Poppins-Regular',
  },
  cellText: {
    alignSelf: 'flex-start',
    color: 'black',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },

  quantityInput: {
    width: 50,
    height: 30,
    padding: 2,
    marginHorizontal: 4,
    color: '#0d0c22',
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 7,
  },

  modalContainer: {
    backgroundColor: '#fff',
    maxHeight: screenHeight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 5,
    flex: 1,
  },

  orderButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    marginHorizontal: 0,
    borderRadius: 10,
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    marginRight: 5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    alignSelf: 'center',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
  },
});

export default RebalanceModal;
