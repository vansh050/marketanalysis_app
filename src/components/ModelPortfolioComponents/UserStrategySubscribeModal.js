import {createPublisherBatchDispatcher} from '../../utils/publisherBatchDispatch';
import React, {
  useState,
  useEffect,
  forwardRef,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {XIcon, Calendar} from 'lucide-react-native';
import axios from 'axios';
import {PUBLISHER_ACK_TIMEOUT_MS, isPublisherActivationAcknowledged} from '../../utils/publisherAcknowledgement';
import {applyKiteMarketProtection, fetchFreshKiteProtectionPrices, getPublisherWebViewBaseUrl, resolveZerodhaSymbol, voidUnsentPublisherRecos} from '../../utils/brokerPublisher';
import {
  createZerodhaPublisherAttempt,
  getKitePublisherTag,
} from '../../utils/publisherOutcome';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import CryptoJS from 'react-native-crypto-js';
import WebView from 'react-native-webview';
import BrokerSelectionModal from '../BrokerSelectionModal';
import server from '../../utils/serverConfig';
import LoadingSpinner from '../LoadingSpinner';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import useKiteHandoffGuard from '../../hooks/useKiteHandoffGuard';
import {executionBundleHeaders, handleStaleExecutionBundle} from '../../utils/executionBundleSafety';
import {accountRecoveryMetadata} from '../../utils/accountRecoveryUx';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import MissedGainText from '../AdviceScreenComponents/DynamicText/BestPerformerGainText';
import WebsocketSubText from '../AdviceScreenComponents/DynamicText/WebsocketSubText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SliderButton from '../SliderButton';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTotalAmount} from '../AdviceScreenComponents/DynamicText/websocketPrice';
import Config from 'react-native-config';
import Toast from 'react-native-toast-message';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {useTrade} from '../../screens/TradeContext';
import {convertResponse} from '../../utils/tradeUtils';
import {useConfig} from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';
import { computeTradeVariant } from '../../utils/tradeVariant';
import moment from 'moment';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import { validateBrokerSession } from '../../utils/brokerSessionUtils';
import { isZerodhaSellAuthorized } from '../../utils/zerodhaDdpiGate';
import useModalStore from '../../GlobalUIModals/modalStore';
import useSdkClient from '../../sdk/useSdkClient';
import {getPlatformDisplayName} from '../../utils/advisorContentProfile';
import PublisherWebViewOverlay from '../PublisherWebViewOverlay';

import { designColor, designFont } from '../../design/literalTokens';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

const {height: screenHeight} = Dimensions.get('window');

const UserStrategySubscribeModal = ({
  visible,
  onClose,
  fileName,
  userEmail,
  clientCode,
  apiKey,
  secretKey,
  jwtToken,
  viewToken,
  sid,
  serverId,
  broker,
  strategyDetails,
  setOpenSubscribeModel,
  latestRebalance,
  setOpenSucessModal,
  setOrderPlacementResponse,
  setBrokerModel,
  BrokerModel,
  setBroker,

  setOpenTokenExpireModel,
}) => {
  const {configData, userDetails} = useTrade();
  const openBrokerModal = useModalStore(state => state.openModal);
  const appConfig = useConfig();
  // For trade `variant` — see docs/APP_ARCHITECTURE.md § 4.5.2.
  const allowAfterHoursOrders = appConfig?.allowAfterHoursOrders;
  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;
  const mainColor = useTokens().colors.brand.primary;
  const [loading, setLoading] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState(false);

  console.log(strategyDetails);

  console.log(
    'strategyDetailsooooooooo',
    strategyDetails,
    'mooo',
    latestRebalance,
  );
  console.log('mooo', latestRebalance.totalInvestmentValue);
  const {getLTPForSymbol} = useWebSocketCurrentPrice(
    latestRebalance.adviceEntries,
  );

  const onCloseModal = () => {
    console.log('Clossse');
    setOpenSubscribeModel(false);
  };

  const [isBrokerConnected, setIsBrokerConnected] = useState(false);
  const [brokername, setBrokerName] = useState('');
  const [createdDate, setcreateDate] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [showIIFLModal, setShowIIFLModal] = useState(false);
  const [showICICIUPModal, setShowICICIUPModal] = useState(false);
  const [showupstoxModal, setShowupstoxModal] = useState(false);
  const [showangleoneModal, setShowangleoneModal] = useState(false);
  const [showzerodhamodal, setShowzerodhaModal] = useState(false);
  const [showhdfcModal, setShowhdfcModal] = useState(false);
  const [showDhanModal, setShowDhanModal] = useState(false);
  const [showKotakModal, setShowKotakModal] = useState(false);

  const showToast = () => {
    Toast.show({
      type: 'error',
      text1: '',
      text2: 'Orders cannot be placed after Market hours.',
    });
  };

  const fetchBrokerStatusModal = async () => {
    if (userEmail) {
      try {
        const response = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${userEmail}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        const userData = response.data.User;
        setBroker(userData.user_broker);
        console.log('Here Broker COnnected:', broker, userData.user_broker);
        setcreateDate(userData.created_at);
        setIsBrokerConnected(!!userData?.user_broker);
        // console.log('corrected');
      } catch (error) {
        //   console.error('Error fetching broker status:', error.response?.data || error.message);
        setIsBrokerConnected(false); // Handle error by setting default status
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBrokerConnect = broker => {
    setIsBrokerConnected(true); // Assuming successful connection
    setModalVisible(false); // Hide modal after selection
    setShowIIFLModal(true); // Show IIFL modal
  };

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    console.log('data erty:', data);
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  const [funds, setFunds] = useState(null);

  useEffect(() => {
    const getFunds = async () => {
      console.log('logg funds:', broker, jwtToken, clientCode);
      const fetchedFunds = await fetchFunds(
        broker,
        clientCode,
        apiKey,
        jwtToken,
        secretKey,
        sid,
        serverId,
        userEmail,
      );
      if (fetchedFunds) {
        console.log('funds get fetch', fetchedFunds);
        setFunds(fetchedFunds);
      } else {
        console.error('Failed to fetch funds.');
      }
    };

    // Call the function when the component mounts or when relevant props change
    if (broker && (clientCode || jwtToken)) {
      getFunds();
    }
  }, [broker, clientCode, apiKey, jwtToken, secretKey]);

  const [calculatedPortfolioData, setCaluculatedPortfolioData] = useState([]);
  const [calculatedLoading, setCalculateLoading] = useState(false);

  // Phase 1 plan freeze (prod-alphaquark-github docs/REBALANCE_PLAN_FREEZE_PLAN.md
  // §4.4/§4.5; this repo's docs/WEB_TO_APP_PORT_PLAN_2026-07.md rebalance-freeze
  // entry): forward the frozen plan_id/plan_version `rebalance/calculate` returned
  // so ccxt executes the server-frozen, re-validated plan instead of the
  // client-posted `trades` — mirrors web's UserStrategySubscribeModal.placeOrder
  // (commit a4cb3c23). This modal has no live repair path (the `matchingRepairTrade`
  // branch in `getAdditionalPayload` below is dead code — that function is never
  // called), so there is no repair-vs-fresh-calc "approve what you see" ambiguity
  // to guard here: every plan_id this modal ever holds came from THIS calculate.
  // Flag off / no plan_id ⇒ fields absent ⇒ byte-identical legacy payload.
  const freezeOn = appConfig?.rebalanceFreezePlan === true;
  const frozenPlanFields = freezeOn && calculatedPortfolioData?.plan_id
    ? {
        plan_id: calculatedPortfolioData.plan_id,
        plan_version: calculatedPortfolioData.plan_version,
      }
    : {};

  // Frozen-plan 409 (PLAN_DRIFTED / expired / ALREADY_CONSUMED — see
  // REBALANCE_PLAN_FREEZE_PLAN.md §4.4): the plan_id we hold is dead, so
  // re-sliding "Place Order" would 409 forever. Drop back to the pre-confirm
  // step (`setConfirmOrder(false)`) whose "Confirm Details" button re-runs
  // calculateRebalance, minting a fresh plan. Mirrors web's recompute handling.
  const handleFrozenPlanRecompute = (error) => {
    const recovery = accountRecoveryMetadata(error);
    if (error?.response?.status === 409 &&
        (error?.response?.data?.recompute || recovery.running)) {
      const verificationPending =
        error?.response?.data?.code === 'RECHECK_UNAVAILABLE' || recovery.running;
      if (recovery.operationId) {
        console.info('[AccountRecovery] Waiting for operation', recovery.operationId);
      }
      setConfirmOrder(false);
      Toast.show({
        type: 'info',
        text1: verificationPending ? 'Checking your broker' : 'Portfolio refreshed',
        text2: verificationPending
          ? 'Nothing was sent. We will refresh this automatically.'
          : (error?.response?.data?.message || 'Please review the updated trades.'),
        visibilityTime: 5000,
      });
      if (verificationPending) {
        setTimeout(
          () => calculateRebalance(),
          recovery.retryAfterSeconds * 1000,
        );
      }
      return true;
    }
    return false;
  };

  const calculateRebalance = () => {
    console.log('hereeeeee', broker, funds?.status);
    setCalculateLoading(true);
    if (!broker) {
      setBrokerModel(true);
      fetchBrokerStatusModal();
      setCalculateLoading(false);
    } else if (funds?.status === 1 || funds?.status === 2 || funds === null) {
      // Funds check matching web frontend: status 1/2 = token issue, null = error
      console.log('Funds status check failed:', funds?.status);
      setOpenTokenExpireModel(true);
      setCalculateLoading(false);
    } else {
      // EDIS pre-flight check for SELL initial allocations.
      //
      // DDPI-priority semantics (per `docs/SELL_AUTH_ARCHITECTURE.md`):
      //   - Zerodha + Angel One have cheap server-cached DDPI flags
      //     (`ddpi_status` / `ddpi_enabled`). DDPI active ⇒ user can
      //     sell freely; never block. Pre-block only when BOTH flags
      //     fail.
      //   - Dhan + Fyers + 8 portal-side brokers either have no
      //     persistent DDPI flag in our schema (Fyers + portal-side)
      //     or use a per-day per-holding live API (Dhan) that this
      //     modal does not pre-fetch. Per user direction 2026-05-03
      //     and CONTRACT § 6 / Phase D `requireSellAuth` design,
      //     we prefer OPTIMISTIC PLACEMENT for these — let the trade
      //     reach the broker; on rejection, surface EDIS UX. The
      //     stored `is_authorized_for_sell` flag is too lossy to
      //     gate on for these brokers (a user with permanent DDPI
      //     at the broker portal would be falsely blocked on
      //     day-rollover before our flag flips).
      //
      // What this gate STILL enforces:
      //   - Zerodha: DDPI status OR session-TPIN flag.
      //   - Angel One: persistent DDPI OR session-TPIN flag.
      //   - 8 portal-side brokers: existing `is_authorized_for_sell`
      //     check (pre-existing pattern in this modal — kept until
      //     Phase D `requireSellAuth` unifies the gate; doc-updated
      //     to call out the over-aggressive behavior).
      //   - Dhan + Fyers: NO PRE-BLOCK. Trade attempts; rejection
      //     surfaces via the placeOrder error path.
      //
      // Phase C orchestrator (`executeAdvice` calling `requireSellAuth`
      // internally) replaces this gate with a unified
      // optimistic-then-cascade pattern where the SDK handles both
      // the live-check brokers AND the post-rejection EDIS UX.
      //
      // Audit refs: `docs/SDK_ORCHESTRATION_AUDIT.md` § Pass 2 /
      // Suspected defect #1 (the 4-broker matrix), § 8.tidi (Flutter's
      // unified DdpiAuthPage as the SDK template).
      const hasSellOrders = latestRebalance?.adviceEntries?.some(
        entry => entry.transactionType === 'SELL',
      );

      if (hasSellOrders) {
        let needsEdisAuth = false;
        let edisMessage = 'Please authorize your stocks for selling at your broker portal before placing sell orders.';

        if (broker === 'Zerodha') {
          // Zerodha: DDPI persisted by `ddpi_status` ∈ {physical, ddpi}
          // (live check via `/zerodha/save-ddpi-status` populates this);
          // OR session-TPIN flag. Either ⇒ proceed.
          const canSellZerodha = isZerodhaSellAuthorized(userDetails);
          if (!canSellZerodha) {
            needsEdisAuth = true;
            edisMessage = 'Please authorize DDPI in Kite Web before placing sell orders.';
          }
        } else if (broker === 'Angel One') {
          // Angel One: persistent DDPI (`ddpi_enabled`, populated by
          // `/angelone/verify-dis` live check) OR session-TPIN flag.
          if (!userDetails?.ddpi_enabled && !userDetails?.is_authorized_for_sell) {
            needsEdisAuth = true;
            edisMessage = 'Please authorize TPIN/DIS in SmartAPI before placing sell orders.';
          }
        } else if (
          ['AliceBlue', 'IIFL Securities', 'ICICI Direct', 'Upstox',
            'Kotak', 'Hdfc Securities', 'Motilal Oswal', 'Groww'].includes(broker) &&
          !userDetails?.is_authorized_for_sell
        ) {
          // Portal-side EDIS brokers — no in-app DDPI/TPIN flow.
          // KEPT for backward-compatibility with prior edisCheckBrokers
          // Toast pattern. Acknowledged over-aggressive per
          // user direction 2026-05-03 (a user with permanent DDPI
          // at the broker portal would be falsely blocked here);
          // Phase D `requireSellAuth` softens this to optimistic
          // placement once the post-rejection EDIS cascade ships.
          needsEdisAuth = true;
        }
        // NOTE: Dhan + Fyers intentionally NOT pre-blocked.
        // Optimistic placement — trade goes through; if broker
        // rejects with EDIS error, the existing placeOrder error
        // path surfaces a Toast. Phase D unifies the post-rejection
        // EDIS UX with `<SellAuthGate>` widget.

        if (needsEdisAuth) {
          setCalculateLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Authorization Required',
            text2: edisMessage,
            visibilityTime: 5000,
          });
          return;
        }
      }

      console.log('ModelName:', strategyDetails);
      let payload = {
        userEmail: userEmail,
        userBroker: broker ? broker : 'DummyBroker',
        modelName: strategyDetails?.model_name?.trim(),
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        userFund: funds?.data?.availablecash ? funds?.data?.availablecash : '0',
      };
      if (broker === 'IIFL Securities') {
        payload = {
          ...payload,
          clientCode: clientCode,
        };
      } else if (broker === 'ICICI Direct') {
        payload = {
          ...payload,
          apiKey: checkValidApiAnSecret(apiKey),
          secretKey: checkValidApiAnSecret(secretKey),
          accessToken: jwtToken,
        };
      } else if (broker === 'Upstox') {
        payload = {
          ...payload,
          clientCode: clientCode,
          apiKey: checkValidApiAnSecret(apiKey),
          apiSecret: checkValidApiAnSecret(secretKey),
          accessToken: jwtToken,
        };
      } else if (broker === 'Angel One') {
        payload = {
          ...payload,
          apiKey: configData?.config?.REACT_APP_ANGEL_ONE_API_KEY,
          jwtToken: jwtToken,
        };
      } else if (broker === 'Kotak') {
        // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
        payload = {
          ...payload,
          consumerKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
          viewToken: viewToken,
          sid: sid,
          serverId: serverId ? serverId : '',
        };
      } else if (broker === 'Hdfc Securities') {
        payload = {
          ...payload,
          apiKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
        };
      } else if (broker === 'Zerodha') {
        payload = {
          ...payload,
          accessToken: jwtToken,
        };
      } else if (broker === 'Fyers') {
        payload = {
          ...payload,
          clientId: clientCode,
          accessToken: jwtToken,
        };
      } else if (broker === 'AliceBlue') {
        payload = {
          ...payload,
          clientId: clientCode,
          apiKey: apiKey,
          accessToken: jwtToken,
        };
      } else if (broker === 'Dhan') {
        payload = {
          ...payload,
          clientId: clientCode,
          accessToken: jwtToken,
        };
      } else if (broker === 'Groww') {
        payload = {
          ...payload,
          accessToken: jwtToken,
        };
      } else if (broker === 'Motilal Oswal') {
        payload = {
          ...payload,
          clientCode: clientCode,
          accessToken: jwtToken,
          apiKey: checkValidApiAnSecret(apiKey),
        };
      }
      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/calculate`,
        data: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };
      console.log('final Payload we get1:', payload);
      console.log(
        'final URL:',
        `${server.ccxtServer.baseUrl}rebalance/calculate`,
      );
      axios
        .request(config)
        .then(response => {
          if (response.data?.reconciliationPending || response.data?.code === 'PUBLISHER_RECONCILIATION_PENDING') {
            setCalculateLoading(false);
            setConfirmOrder(false);
            setCaluculatedPortfolioData([]);
            Toast.show({
              type: 'info',
              text1: 'Verifying broker portfolio',
              text2: response.data?.message || 'No new orders were placed. Refresh status shortly.',
              visibilityTime: 8000,
            });
            return;
          }
          if (response.data?.sessionExpired === true) {
            setCalculateLoading(false);
            setConfirmOrder(false);
            Toast.show({
              type: 'error',
              text1: 'Broker session expired',
              text2: 'Please reconnect your broker and try again.',
            });
            return;
          }
          if (response.data) {
            console.log('resposidi:', response.data);
            setCaluculatedPortfolioData(response.data);
            setCalculateLoading(false);
            setConfirmOrder(true);
          } else {
            setCaluculatedPortfolioData([]);
            setCalculateLoading(false);
            setConfirmOrder(false);
          }
        })
        .catch(error => {
          setCalculateLoading(false);
          setConfirmOrder(false);
          setCaluculatedPortfolioData([]);
          const body = error?.response?.data;
          const pending = body?.reconciliationPending || body?.code === 'PUBLISHER_RECONCILIATION_PENDING';
          Toast.show({
            type: pending ? 'info' : 'error',
            text1: pending ? 'Verifying broker portfolio' : 'Could not calculate rebalance',
            text2: body?.message || 'Please refresh status and try again.',
            visibilityTime: 8000,
          });
          console.log(error);
        });
    }
  };

  const dataArray =
    calculatedPortfolioData?.length !== 0
      ? [
          ...calculatedPortfolioData?.buy.map(item => ({
            symbol: item.symbol,
            token: item?.token ? item?.token : '',
            qty: item.quantity,
            orderType: 'BUY',
            exchange: item.exchange,
          })),
          ...calculatedPortfolioData?.sell.map(item => ({
            symbol: item.symbol,
            token: item?.token ? item?.token : '',
            qty: item.quantity,
            orderType: 'SELL',
            exchange: item.exchange,
          })),
        ]
      : [];
  console.log('Data:', dataArray);
  const totalInvestmentValue = dataArray
    .filter(item => item.orderType === 'BUY')
    .reduce((total, item) => {
      const currentPrice = getLTPForSymbol(item.symbol);
      const investment = item.qty * currentPrice;
      return total + investment;
    }, 0);

  const stockDetails = convertResponse(dataArray, broker);

  // ccxt-india scripmaster map — drives Kite basket tradingsymbol/exchange.
  // Enabled only when the modal is open; memoized by the joined advice-side
  // trading-symbol list, so repeat renders don't refetch.
  const symbolMap = useZerodhaSymbolMap(stockDetails, visible);

  const totalAmount = useTotalAmount(stockDetails);
  console.log('totalAmount:::', totalAmount);

  // --- Fyers Publisher Flow ---
  const handleFyersRedirect = async () => {
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) return;

    setLoading(true);
    try {
      const currentISTDateTime = new Date();
      const istDatetime = moment(currentISTDateTime).format();

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      // Record trade intent
      try {
        await axios.post(
          `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
          {
            stockDetails: stockDetails,
            leaving_datetime: currentISTDateTime,
            email: userEmail,
            trade_given_by: strategyDetails?.advisor || configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          },
          { headers: requestHeaders },
        );
      } catch (recoErr) {
        console.warn('[FyersPublisher] update-reco failed (non-critical):', recoErr);
      }

      // Place orders via Fyers API through process-trade
      // Trade variant per-trade — see docs/APP_ARCHITECTURE.md § 4.5.2.
      const fyersVariant = computeTradeVariant(allowAfterHoursOrders);
      const payload = {
        clientId: clientCode,
        accessToken: jwtToken,
        user_email: userEmail,
        user_broker: 'Fyers',
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        unique_id: calculatedPortfolioData?.uniqueId,
        ...frozenPlanFields,
        returnDateTime: istDatetime,
        trades: stockDetails.map(s => ({ ...s, variant: fyersVariant })),
      };

      // SDK executeAdvice dual-path (Phase C) — Fyers initial allocation.
      let response;
      if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResult = await sdkClient.executeAdvice({
            kind: 'mpInitialAllocation',
            clientAdviceId: `mp-initial:Fyers:${latestRebalance?._id || calculatedPortfolioData?.uniqueId || latestRebalance?.model_Id}`,
            brokerName: 'Fyers',
            modelId: latestRebalance?.model_Id,
            modelName: strategyDetails?.model_name,
            uniqueId: calculatedPortfolioData?.uniqueId,
            trades: payload.trades,
            subscriptionId: latestRebalance?._id || '',
          });
          const mappedRows = (sdkResult?.rows || []).map(row => ({
            ...row,
            orderStatus: row.status,
            tradingSymbol: row.symbol,
          }));
          response = { data: { results: mappedRows } };
          console.log('[UserStrategySubscribeModal] SDK executeAdvice (Fyers) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
        } catch (sdkErr) {
          console.error('[UserStrategySubscribeModal] SDK owns this Fyers attempt; legacy fallback blocked:', sdkErr?.message);
          throw sdkErr;
        }
      }
      if (!response) {
        response = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/process-trade`,
          payload,
          { headers: requestHeaders, timeout: 120000 },
        );
      }

      const checkData = response?.data?.results;

      // Handle session expired - broker needs reconnection
      if (response?.data?.sessionExpired) {
        setLoading(false);
        onCloseModal();
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: `Your Fyers session has expired. Please reconnect your broker.`,
          visibilityTime: 5000,
        });
        setTimeout(() => {
          openBrokerModal('Fyers');
        }, 500);
        return;
      }

      setOrderPlacementResponse(checkData);

      // Update model portfolio DB
      const updateData = {
        modelId: latestRebalance?.model_Id,
        orderResults: checkData,
        modelName: strategyDetails?.model_name,
        userEmail: userEmail,
        user_broker: 'Fyers',
      };
      await axios.post(
        `${server.server.baseUrl}api/model-portfolio-db-update`,
        updateData,
        { headers: requestHeaders },
      );

      // Update subscriber execution status
      if (checkData && checkData.length > 0) {
        const successStatuses = ['complete', 'executed', 'traded'];
        const pubSuccessCount = checkData.filter(r =>
          successStatuses.includes((r.orderStatus || '').toLowerCase()),
        ).length;
        let executionStatus;
        if (pubSuccessCount === checkData.length) {
          executionStatus = 'executed';
        } else if (pubSuccessCount > 0) {
          executionStatus = 'partial';
        } else {
          executionStatus = 'pending';
        }

        try {
          await axios.put(
            `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
            {
              userEmail: userEmail,
              modelName: strategyDetails?.model_name,
              model_id: latestRebalance?.model_Id,
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
              modelName: strategyDetails?.model_name,
              model_id: latestRebalance?.model_Id,
              unique_id: calculatedPortfolioData?.uniqueId,
              advisor: strategyDetails?.advisor,
              order_results: checkData,
              user_email: userEmail,
              user_broker: 'Fyers',
              ...frozenPlanFields,
            },
            { headers: requestHeaders },
          );
          console.log('[FyersPublisher] Successfully recorded publisher results');
        } catch (err) {
          console.warn('[FyersPublisher] record-publisher-results failed:', err);
        }
      }

      // Enroll in status-check-queue
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Fyers',
          },
          { headers: requestHeaders },
        );
      } catch (queueErr) {
        console.warn('[FyersPublisher] status-check-queue failed:', queueErr);
      }

      setLoading(false);
      setOpenSucessModal(true);
      setOpenSubscribeModel(false);
    } catch (error) {
      setLoading(false);
      console.error('[FyersPublisher] Error:', error);

      if (handleFrozenPlanRecompute(error)) {
        return;
      }

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
    }
  };
  // --- End Fyers Publisher Flow ---

  const onSlideComplete = () => {
    if (broker === 'Zerodha') {
      handleZerodhaRedirect();
    } else if (broker === 'Fyers') {
      handleFyersRedirect();
    } else {
      placeOrder();
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    // Trade variant per-trade — see docs/APP_ARCHITECTURE.md § 4.5.2.
    const variant = computeTradeVariant(allowAfterHoursOrders);
    const tradesWithVariant = stockDetails.map(s => ({ ...s, variant }));

    const getBasePayload = () => ({
      modelName: strategyDetails?.model_name,
      advisor: strategyDetails?.advisor,
      model_id: latestRebalance.model_Id,
      unique_id: calculatedPortfolioData?.uniqueId,
      ...frozenPlanFields,
      user_broker: broker,
      user_email: userEmail,
      trades: tradesWithVariant,
    });

    const getBrokerSpecificPayload = () => {
      switch (broker) {
        case 'IIFL Securities':
          return {
            clientCode,
            user_broker: 'IIFL Securities',
            accessToken: jwtToken,
          };
        case 'ICICI Direct':
        case 'Upstox':
          return {
            apiKey: checkValidApiAnSecret(apiKey),
            secretKey: checkValidApiAnSecret(secretKey),
            [broker === 'Upstox' ? 'accessToken' : 'sessionToken']: jwtToken,
          };
        case 'Angel One':
          return {apiKey, jwtToken};
        case 'Hdfc Securities':
          return {
            apiKey: checkValidApiAnSecret(apiKey),
            accessToken: jwtToken,
          };
        case 'Dhan':
          return {
            clientId: clientCode,
            accessToken: jwtToken,
          };
        case 'Kotak':
          // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
          return {
            consumerKey: checkValidApiAnSecret(apiKey),
            accessToken: jwtToken,
            viewToken: viewToken,
            sid: sid,
            serverId: serverId,
          };
        case 'Fyers':
          return {
            clientId: clientCode,
            accessToken: jwtToken,
          };
        case 'AliceBlue':
          return {
            clientId: clientCode,
            accessToken: jwtToken,
            apiKey: checkValidApiAnSecret(apiKey),
          };
        case 'Groww':
          return {
            accessToken: jwtToken,
          };
        case 'Motilal Oswal':
          return {
            clientCode: clientCode,
            accessToken: jwtToken,
            apiKey: checkValidApiAnSecret(apiKey),
          };
        default:
          return {};
      }
    };

    const payload = {
      ...getBasePayload(),
      ...getBrokerSpecificPayload(),
    };
    console.log('Payload:', payload);
    const config = {
      method: 'post',
      url: `${server.ccxtServer.baseUrl}rebalance/process-trade`,
      data: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    // SDK executeAdvice dual-path (Phase C) — main broker initial allocation.
    let sdkResponse = null;
    if (sdkExecuteAdviceEnabled) {
      try {
        const sdkResult = await sdkClient.executeAdvice({
          kind: 'mpInitialAllocation',
          clientAdviceId: `mp-initial:${broker}:${latestRebalance?._id || calculatedPortfolioData?.uniqueId || latestRebalance?.model_Id}`,
          brokerName: broker,
          modelId: latestRebalance?.model_Id,
          modelName: strategyDetails?.model_name,
          uniqueId: calculatedPortfolioData?.uniqueId,
          trades: payload.trades,
          subscriptionId: latestRebalance?._id || '',
        });
        const mappedRows = (sdkResult?.rows || []).map(row => ({
          ...row,
          orderStatus: row.status,
          tradingSymbol: row.symbol,
        }));
        sdkResponse = { data: { results: mappedRows } };
        console.log('[UserStrategySubscribeModal] SDK executeAdvice (main) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
      } catch (sdkErr) {
        console.error('[UserStrategySubscribeModal] SDK owns this attempt; legacy fallback blocked:', sdkErr?.message);
        throw sdkErr;
      }
    }

    (sdkResponse ? Promise.resolve(sdkResponse) : axios.request(config))
      .then(response => {
        // Handle session expired - broker needs reconnection
        if (response?.data?.sessionExpired) {
          setLoading(false);
          onCloseModal();
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: `Your ${broker} session has expired. Please reconnect your broker.`,
            visibilityTime: 5000,
          });
          setTimeout(() => {
            openBrokerModal(broker);
          }, 500);
          return;
        }

        console.log('responsi:', response.data.results);
        setOrderPlacementResponse(response.data.results);
        const updateData = {
          modelId: latestRebalance.model_Id,
          orderResults: response.data.results,
          modelName: strategyDetails?.model_name,
          userEmail: userEmail,
        };

        return axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          updateData,
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
      })
      .then(() => {
        // Add user to status check queue for async order status polling (matching web frontend)
        const statusCheckData = {
          userEmail: userEmail,
          modelName: strategyDetails?.model_name,
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          broker: broker,
        };
        return axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          statusCheckData,
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
      })
      .then(() => {
        setLoading(false);
        setOpenSucessModal(true);
        setOpenSubscribeModel(false);
      })
      .catch(error => {
        console.error('Error in placeOrder:', error);
        setLoading(false);
        handleFrozenPlanRecompute(error);
        // Consider adding error handling here, e.g., showing an error modal
      });
  };

  const getBasePayload = () => ({
    modelName: strategyDetails?.model_name,
    advisor: strategyDetails?.advisor,
    model_id: latestRebalance.model_Id,
    unique_id: calculatedPortfolioData?.uniqueId,
    ...frozenPlanFields,
    broker: broker,
  });

  const additionalPayload = getBasePayload();
  const publisherLaunchPendingRef = useRef(false);
  const publisherIntentFiredRef = useRef(false);
  const publisherFullLegsRef = useRef([]);
  const publisherBatchDispatcherRef = useRef(createPublisherBatchDispatcher());
  const publisherAttemptRef = useRef(null);

  useEffect(() => {
    publisherIntentFiredRef.current = false;
    publisherAttemptRef.current = null;
  }, [calculatedPortfolioData?.uniqueId, frozenPlanFields.plan_id]);

  const recordPublisherIntent = async (publisherLegs, attempt, activationLegs, activationId) => {
    if (
      !calculatedPortfolioData?.uniqueId ||
      !userEmail
    ) {
      throw new Error('Refresh the portfolio to restore the execution identity.');
    }
    publisherIntentFiredRef.current = true;
    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': getTenantSubdomain(configData),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
      ...executionBundleHeaders(),
    };
    try {
      const context = {
        source: 'mobile-model-portfolio-initial-allocation',
        attemptId: attempt.attemptId,
        modelId: latestRebalance?.model_Id,
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        uniqueId: calculatedPortfolioData?.uniqueId,
        planId: frozenPlanFields.plan_id || null,
      };
      const nodeIntentResponse = await axios.post(
        `${server.server.baseUrl}api/process-trades/execution-intent`,
        {
          userEmail,
          broker: 'Zerodha',
          flow: 'initial_allocation',
          lifecycle: 'popup_opened',
          attemptId: attempt.attemptId,
          context,
          legs: publisherLegs,
        },
        {timeout: PUBLISHER_ACK_TIMEOUT_MS, headers},
      );
      if (
        !nodeIntentResponse?.data?.intentId ||
        nodeIntentResponse?.data?.attemptId !== attempt.attemptId ||
        nodeIntentResponse?.data?.payloadMismatch
      ) {
        throw new Error('Execution session acknowledgement was incomplete');
      }

      const response = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/publisher/intent`,
        {
          unique_id: calculatedPortfolioData.uniqueId,
          user_email: userEmail,
          user_broker: 'Zerodha',
          modelName: strategyDetails?.model_name,
          model_id: latestRebalance?.model_Id,
          advisor: strategyDetails?.advisor,
          legs: publisherLegs,
          kind: 'initial_allocation',
          attempt_id: attempt.attemptId,
          plan_id: frozenPlanFields.plan_id || null,
          plan_version: frozenPlanFields.plan_version ?? null,
          prepare_only: false,
          activation_legs: activationLegs,
          activation_id: activationId,
        },
        {
          timeout: PUBLISHER_ACK_TIMEOUT_MS,
          headers,
        },
      );
      if (!isPublisherActivationAcknowledged(response?.data) ||
          response?.data?.dispatchReserved !== true || response?.data?.activationId !== activationId) {
        throw new Error('Publisher reconciliation was not durably enrolled');
      }
      return true;
    } catch (error) {
      publisherIntentFiredRef.current = false;
      // Refused before the dispatch boundary — nothing reached the broker, so
      // the reco rows this attempt just wrote must not reach the Orders screen.
      await voidUnsentPublisherRecos({
        legs: activationLegs,
        email: userEmail,
        headers,
        error,
      });
      await handleStaleExecutionBundle(error);
      throw error;
    }
  };
  //////Zerodha Start
  const [isWebView, setWebView] = useState(false);
  const webViewRef = useRef(null);
  const kiteHandoff = useKiteHandoffGuard({
    visible: isWebView,
    webViewRef,
    configData,
    flow: 'model_initial_allocation',
    attemptId: publisherAttemptRef.current?.attemptId,
  });
  const [htmlContentfinal, setHtmlContent] = useState('');
  // Quotes and funding state keep updating behind this modal. Keep the HTML
  // source stable so Android does not reload Kite and disconnect its focused
  // login input whenever the React parent renders.
  const publisherWebViewBaseUrl = getPublisherWebViewBaseUrl(configData);
  const publisherWebViewSource = useMemo(
    () => ({html: htmlContentfinal, baseUrl: publisherWebViewBaseUrl}),
    [htmlContentfinal, publisherWebViewBaseUrl],
  );

  const getAdditionalPayload = () => {
    if (matchingRepairTrade) {
      return {
        modelName: matchingRepairTrade.modelName,
        advisor: matchingRepairTrade.advisorName,
        unique_id: matchingRepairTrade?.uniqueId,
        model_id: modelPortfolioModelId,
        broker: broker,
      };
    } else {
      return {
        modelName: filteredData[0]['model_name'],
        advisor: filteredData[0]['advisor'],
        unique_id: calculatedPortfolioData?.uniqueId,
        model_id: modelPortfolioModelId,
        broker: broker,
      };
    }
  };
  //const additionalPayload = getAdditionalPayload();
  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);
  const handleWebViewNavigationStateChange = newNavState => {
    // Handle navigation state changes, e.g., success/failure redirects

    const {url} = newNavState;
    console.log('url at Review Modal :', url);
    if (url.includes('success') || url.includes('completed')) {
      console.log('success url at Review Modal :', url);
      setZerodhaStatus('success');
      setZerodhaRequestType('rebalance');
      console.log('Status of Placement:', zerodhaStatus, zerodhaRequestType);
    }
  };
  const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY;
  const handleZerodhaRedirect = async () => {
    if (publisherLaunchPendingRef.current) return;
    publisherLaunchPendingRef.current = true;
    try {
    // Tag `variant` once at the top of the function. Used for the
    // `update-reco-with-zerodha-model-pf` call below AND injected into the
    // `filteredStockDetails` shape written to AsyncStorage — without this
    // tag, the field is dropped by the explicit field-by-field mapping at
    // the .then() handler. See docs/APP_ARCHITECTURE.md § 4.5.2 Trade
    // variant field.
    const zerodhaVariant = computeTradeVariant(allowAfterHoursOrders);
    const zerodhaTrades = (stockDetails || []).map(s => ({ ...s, variant: zerodhaVariant }));
    console.log('THos caalled', zerodhaTrades);
    try {
      console.log('This is called', zerodhaTrades);
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');
      AsyncStorage.setItem(
        'zerodhaAdditionalPayload',
        JSON.stringify(additionalPayload),
      );

      //  console.log('Stock details updated in AsyncStorage.');
    } catch (error) {
      console.error('Error handling Zerodha redirect:', error);
    }
    const apiKey = zerodhaApiKey;
    const buildBasket = (publisherLegs, freshProtectionPrices) => publisherLegs.map(stock => {
      // Scripmaster-resolved symbol/exchange.
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      let baseOrder = {
        variety: 'regular',
        tradingsymbol: resolved.tradingsymbol,
        exchange: resolved.exchange,
        transaction_type: stock.transactionType,
        order_type: stock.orderType,
        quantity: stock.quantity,
        readonly: false,
        tag: getKitePublisherTag(stock),
      };

      // LTP preference: live ws on resolved symbol → live on raw symbol →
      // server-cached LTP from /zerodha/convert-symbol. Last one covers
      // BE-series / BSE-primary symbols where NSE ws emits nothing.
      console.log('Baseee:', baseOrder);
      const freshLtp = Number(
        freshProtectionPrices?.[String(resolved.tradingsymbol || '').toUpperCase()],
      );
      const isMarket = String(stock.orderType || '').toUpperCase() === 'MARKET';
      const liveLtp = getLTPForSymbol(resolved.tradingsymbol) || getLTPForSymbol(stock.tradingSymbol);
      const ltp = isMarket
        ? freshLtp
        : (liveLtp && liveLtp !== '-' && parseFloat(liveLtp) > 0
          ? liveLtp
          : resolved.cachedLtp || 0);
      console.log('ltp of sym:', ltp, resolved.tradingsymbol);
      if (ltp !== '-' && ltp !== 0) {
        baseOrder.price = parseFloat(ltp);
      }

      if (stock.orderType === 'LIMIT') {
        baseOrder.price = parseFloat(stock.price || 0);
      } else if (stock.orderType === 'MARKET') {
        if (ltp !== '-' && ltp !== 0) {
          baseOrder.price = parseFloat(ltp);
        } else {
          baseOrder.price = 0;
        }
      }

      if (stock.quantity > 100) {
        baseOrder.readonly = true;
      }
      // MARKET → LIMIT-IOC with 1% market-protection buffer for GSM/T2T/BE stocks.
      const protectedOrder = applyKiteMarketProtection(baseOrder, ltp, stock.transactionType);
      console.log('BaseOrder:', protectedOrder);
      return protectedOrder;
    });

    const currentISTDateTime = new Date();

    try {
      console.log('now here:');
      // Persist the recommendation first and wait for the tagged response.
      // The previous call accidentally passed headers as the POST body and
      // the real body as Axios config, then opened Kite before `.then()` had
      // stored anything. That race is why initial allocations could fail to
      // open or open without recoverable order identity.
      const res = await axios.post(
        `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
        {
          stockDetails: zerodhaTrades,
          leaving_datetime: currentISTDateTime,
          email: userEmail,
          trade_given_by:
            configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG ||
            getPlatformDisplayName(),
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
      const allStockDetails = res?.data?.data || [];
      if (allStockDetails.length !== zerodhaTrades.length) {
        throw new Error('Could not prepare every portfolio order safely');
      }
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
        zerodhaTradeId: detail.zerodhaTradeId,
        publisherTag: detail.zerodhaTradeId,
        modelId: latestRebalance?.model_Id,
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        uniqueId: calculatedPortfolioData?.uniqueId,
        user_broker: 'Zerodha',
        variant: detail.variant || zerodhaVariant,
      }));
      const publisherAttempt = createZerodhaPublisherAttempt({
        stockDetails: filteredStockDetails,
        userEmail,
        flow: 'initial_allocation',
      });
      publisherAttemptRef.current = publisherAttempt;
      publisherFullLegsRef.current = JSON.parse(JSON.stringify(filteredStockDetails));
      await AsyncStorage.multiSet([
        ['stockDetailsZerodhaOrder', JSON.stringify(filteredStockDetails)],
        ['zerodhaAdditionalPayload', JSON.stringify({
          ...additionalPayload,
          attemptId: publisherAttempt.attemptId,
        })],
      ]);

      const freshProtectionPrices = await fetchFreshKiteProtectionPrices(
        filteredStockDetails,
        symbolMap,
      );

      // Generate HTML form content
      // Record the frozen plan immediately before the Kite basket opens. This
      // preserves a recoverable pre-execution boundary if the WebView/app is
      // closed before the normal process-trade callback can record results.
      await publisherBatchDispatcherRef.current.run({
        attemptId: publisherAttempt.attemptId, index: 0, legs: filteredStockDetails,
        authorize: activationId => recordPublisherIntent(
          publisherFullLegsRef.current, publisherAttempt, filteredStockDetails, activationId,
        ),
        open: async () => {
          const basket = buildBasket(filteredStockDetails, freshProtectionPrices);
          setHtmlContent(generateHtmlForm(basket, apiKey));
          setWebView(true);
          setLoading(false);
        },
      });
    } catch (error) {
      console.error('Failed to update trade recommendation:', error);
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Could not safely open Zerodha',
        text2: error?.response?.data?.message || error?.message || 'Please try again.',
        visibilityTime: 6000,
      });
    }

    } finally { publisherLaunchPendingRef.current = false; }
  };

  const appURL = 'test';
  const generateHtmlForm = (basket, apiKey) => {
    return `<html>
       <body>
         <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
           <input type="hidden" name="api_key" value="${apiKey}" />
           <input type="hidden" name="data" value='${JSON.stringify(basket)}' />
           <input type="hidden" name="redirect_params" value="${appURL}=true" />
         </form>
         <script>
           document.getElementById('zerodhaForm').submit();
         </script>
       </body>
     </html>
   `;
  };

  const [zerodhaStockDetails, setZerodhaStockDetails] = useState(null);
  const [zerodhaAdditionalPayload, setZerodhaAdditionalPayload] =
    useState(null);

  const fetchData = async () => {
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
      console.log(
        'fetch items zero:',
        zerodhaStockDetails,
        zerodhaAdditionalPayload,
      );
      return {zerodhaStockDetails, zerodhaAdditionalPayload};
    } catch (error) {
      console.error('Error fetching data from AsyncStorage:', error);
      return {zerodhaStockDetails: null, zerodhaAdditionalPayload: null};
    }
  };

  const checkZerodhaStatus = async () => {
    const {zerodhaStockDetails, zerodhaAdditionalPayload} = await fetchData();
    console.log('Got it');
    const currentISTDateTime = new Date();
    const istDatetime = moment(currentISTDateTime).format();
    console.log(
      'Zerodha Stock CheckzerodhaStatus:',
      zerodhaStockDetails,
      'and ',
      zerodhaAdditionalPayload,
      'jwtToken:',
      jwtToken,
    );
    if (
      zerodhaStatus !== null &&
      zerodhaAdditionalPayload !== null &&
      zerodhaStockDetails !== null &&
      zerodhaRequestType === 'rebalance'
    ) {
      console.log(
        'Zerodha Stock CheckzerodhaStatus:',
        zerodhaStockDetails,
        'and ',
        zerodhaAdditionalPayload,
        'jwtToken:',
        jwtToken,
      );
      console.log('isDatetime:', istDatetime, 'Zerodha Api:', zerodhaApiKey);
      try {
        let data = JSON.stringify({
          apiKey: zerodhaApiKey,
          accessToken: jwtToken,
          user_email: userEmail,
          user_broker: zerodhaAdditionalPayload.broker,
          modelName: zerodhaAdditionalPayload.modelName,
          advisor: zerodhaAdditionalPayload.advisor,
          model_id: zerodhaAdditionalPayload.model_id,
          unique_id: zerodhaAdditionalPayload.unique_id,
          attempt_id: zerodhaAdditionalPayload.attemptId,
          // Carried through from the persisted `additionalPayload` (built by
          // the top-level getBasePayload() above, which already applies the
          // same frozenPlanFields gate) — present only when rebalanceFreezePlan
          // is on and the calculate that ran before this WebView redirect
          // minted a plan_id.
          ...(zerodhaAdditionalPayload.plan_id
            ? {
                plan_id: zerodhaAdditionalPayload.plan_id,
                plan_version: zerodhaAdditionalPayload.plan_version,
              }
            : {}),
          returnDateTime: istDatetime,
          trades: zerodhaStockDetails,
        });

        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}rebalance/process-trade`,

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
        // Use await instead of .then()
        console.log('Data that we send:', data);

        // SDK executeAdvice dual-path (Phase C) — Zerodha publisher path.
        let response;
        if (sdkExecuteAdviceEnabled) {
          try {
            const sdkResult = await sdkClient.executeAdvice({
              kind: 'mpInitialAllocation',
              clientAdviceId: `mp-initial:Zerodha:${latestRebalance?._id || zerodhaAdditionalPayload.unique_id || zerodhaAdditionalPayload.model_id}`,
              brokerName: zerodhaAdditionalPayload.broker || 'Zerodha',
              modelId: zerodhaAdditionalPayload.model_id,
              modelName: zerodhaAdditionalPayload.modelName,
              uniqueId: zerodhaAdditionalPayload.unique_id,
              trades: zerodhaStockDetails,
              subscriptionId: latestRebalance?._id || '',
            });
            const mappedRows = (sdkResult?.rows || []).map(row => ({
              ...row,
              orderStatus: row.status,
              tradingSymbol: row.symbol,
            }));
            response = { data: { results: mappedRows } };
            console.log('[UserStrategySubscribeModal] SDK executeAdvice (Zerodha) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
          } catch (sdkErr) {
            console.error('[UserStrategySubscribeModal] SDK owns this Zerodha attempt; legacy fallback blocked:', sdkErr?.message);
            throw sdkErr;
          }
        }
        if (!response) {
          response = await axios.request(config);
        }

        // Handle session expired - broker needs reconnection
        if (response?.data?.sessionExpired) {
          setLoading(false);
          onCloseModal();
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: `Your Zerodha session has expired. Please reconnect your broker.`,
            visibilityTime: 5000,
          });
          setTimeout(() => {
            openBrokerModal('Zerodha');
          }, 500);
          return;
        }

        console.log('Status Call here:2,', response.data.results);
        setOrderPlacementResponse(response.data.results);
        setOpenSucessModal(true);
        setOpenRebalanceModal(false);
        eventEmitter.emit('OrderPlacedReferesh');

        try {
          const config = {
            method: 'post',
            url: `${server.ccxtServer.baseUrl}zerodha/user-portfolio`,

            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },

            data: JSON.stringify({user_email: userEmail}),
          };
          await axios.request(config);

          // Add user to status check queue for async order status polling (matching web frontend)
          const statusCheckData = {
            userEmail: userEmail,
            modelName: zerodhaAdditionalPayload.modelName,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Zerodha',
          };
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
            statusCheckData,
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
        } catch (error) {
          console.error(`Error updating portfolio for`, error);
        }
        AsyncStorage.removeItem('stockDetailsZerodhaOrder');
        AsyncStorage.removeItem('zerodhaAdditionalPayload');
        setflag(false);
      } catch (error) {
        console.log('Something went wrong');
        if (handleFrozenPlanRecompute(error)) {
          // Clear the stale persisted plan-tied payload so a stray re-fire
          // of the WebView-completion effect can't resubmit a dead plan_id.
          AsyncStorage.removeItem('stockDetailsZerodhaOrder');
          AsyncStorage.removeItem('zerodhaAdditionalPayload');
        }
      }
    }

    // Clear the post-submission state once the order-book check has run, so
    // this modal stops offering a fresh Place Order while record-back is
    // still settling (the same window the RebalanceModal gate covers).
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
  };

  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        // Fetch data and wait until it resolves
        const {zerodhaStockDetails, zerodhaAdditionalPayload} =
          await fetchData();

        console.log(
          'ZerodhaOP:',
          zerodhaStatus,
          zerodhaRequestType,
          jwtToken,
          zerodhaAdditionalPayload,
          zerodhaStockDetails,
        );

        // Continue processing only after data is fetched
        if (
          zerodhaStatus !== null &&
          zerodhaAdditionalPayload !== null &&
          zerodhaStockDetails !== null &&
          zerodhaRequestType === 'rebalance' &&
          jwtToken !== undefined
        ) {
          console.log('Hereee:');
          checkZerodhaStatus(); // Only called after fetchData completes
        }
      } catch (error) {
        console.error('Error in fetchAndProcessData:', error);
      }
    };

    fetchAndProcessData(); // Trigger the async function
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  console.log('Data array:', dataArray);
  const renderTableHeader = headers => (
    <View style={[styles.row, styles.header]}>
      {headers.map((header, index) => (
        <Text key={index} style={styles.headerText}>
          {header}
        </Text>
      ))}
    </View>
  );

  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setWebView(false);
  };

  const renderRow = (ele, isRebalance = false) => {
    console.log('Ele:', ele);
    const symbol = ele.symbol;
    const iniprice = 0;
    const exe = ele.exchange;
    return (
      <View key={ele.symbol} style={styles.row}>
        <Text style={styles.cellText}>{ele.symbol}</Text>

        <View style={{flex: 1}}>
          <MissedGainText
            advisedRangeCondition={0}
            symbol={symbol || ''}
            exchange={exe}
            advisedPrice={iniprice || 0}
            type={'aftersub'}
          />
        </View>

        <Text style={styles.cellText}>
          {isRebalance ? `${parseFloat(ele.value * 100).toFixed(2)}%` : ele.qty}
        </Text>
        <Text
          style={[
            styles.cellText,
            ele?.orderType?.toLowerCase() === 'buy'
              ? styles.buyText
              : ele?.orderType?.toLowerCase() === 'sell'
              ? styles.sellText
              : styles.defaultText,
          ]}>
          {ele?.orderType?.toUpperCase() || 'BUY'}
        </Text>
      </View>
    );
  };

  const [selectedYear, setSelectedYear] = useState(null);
  const [sipType, setSipType] = useState(null);
  const [startDate, setStartDate] = useState(null);

  const yearOptions = ['1Y', '3Y', '5Y', '10Y'];

  const CustomInput = forwardRef(({value, onClick}, ref) => (
    <View style={styles.inputContainer}>
      <TextInput
        value={value}
        onPressIn={onClick}
        ref={ref}
        placeholder="dd/mm/yy"
        editable={false}
        style={styles.input}
      />
      <CalendarIcon style={styles.calendarIcon} />
    </View>
  ));

  // The Kite run returns before record-back and the order-book check finish.
  // Re-showing a placeable review in that window reads as "nothing happened,
  // place them again" while the orders are already with the broker
  // (prod/arulthakur, 2026-09-17: a second launch minted the orphan rows).
  const awaitingOrderStatus = zerodhaStatus === 'success' && !isWebView;

  if (visible && isWebView) {
    return (
      <PublisherWebViewOverlay
        source={publisherWebViewSource}
        webViewRef={webViewRef}
        onClose={handleClose}
        onLoadStart={event => {
          setIsLoading(true);
          kiteHandoff.onLoadStart(event);
        }}
        onLoadEnd={event => {
          setIsLoading(false);
          kiteHandoff.onLoadEnd(event);
        }}
        onNavigationStateChange={state => {
          kiteHandoff.onNavigationStateChange(state);
          handleWebViewNavigationStateChange(state);
        }}
        onError={kiteHandoff.onError}
        onHttpError={kiteHandoff.onHttpError}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      backdropOpacity={0.5}
      useNativeDriver
      hideModalContentWhileAnimating
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection={['down']}
      transparent
      animationType="fade"
      hardwareAccelerated={true}>
      <View style={styles.modalContainer}>
        {isWebView ? (
          <View
            style={{
              flex: 1,
              height: 600,
              borderTopRightRadius: 10,
              borderTopLeftRadius: 10,
              backgroundColor: 'white',
              padding: 10,
            }}>
            <View style={{alignContent: 'flex-end', alignItems: 'flex-end'}}>
              <XIcon onPress={handleClose} size={16} color={'black'} />
            </View>
            <WebView
              ref={webViewRef}
              style={{
                flex: 1,
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
              }}
              source={publisherWebViewSource}
              onLoadStart={event => {
                setIsLoading(true);
                kiteHandoff.onLoadStart(event);
              }}
              onLoadEnd={event => {
                setIsLoading(false);
                kiteHandoff.onLoadEnd(event);
              }}
              onNavigationStateChange={state => {
                kiteHandoff.onNavigationStateChange(state);
                handleWebViewNavigationStateChange(state);
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              androidLayerType="hardware"
              setSupportMultipleWindows={false}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              keyboardDisplayRequiresUserAction={false}
              onError={kiteHandoff.onError}
              onHttpError={kiteHandoff.onHttpError}
            />
          </View>
        ) : (
          <View>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {confirmOrder
                    ? `Invest in ${fileName} `
                    : 'Review Trade Details of'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onCloseModal}>
                  <XIcon size={24} color="grey" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.container}>
                {confirmOrder ? (
                  <>
                    {dataArray?.length ? (
                      <View>
                        {renderTableHeader([
                          'Constituents',
                          'Current Price (₹)',
                          'Quantity',
                          'Order Type',
                        ])}
                        {dataArray.map(ele => renderRow(ele))}
                      </View>
                    ) : (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorTitle}>
                          Something Went Wrong
                        </Text>
                        <Text style={styles.errorSubtitle}>
                          We ran into an issue with your broker. Please try
                          again later.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View>
                    {renderTableHeader([
                      'Constituents',
                      'Current Price(₹)',
                      'Weights(%)',
                      'Order Type',
                    ])}
                    {latestRebalance?.adviceEntries.map(ele =>
                      renderRow(ele, true),
                    )}
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={styles.footer}>
              {!confirmOrder && (
                <View style={{marginLeft: 15}}>
                  <Text style={styles.footerText1}>₹ {totalAmount}</Text>
                  <Text style={styles.footerText}>Total Amount Required</Text>
                </View>
              )}

              {confirmOrder ? (
                // Show the SliderButton when 'confirmOrder' is true
                (<GestureHandlerRootView style={{flex: 1}}>
                  {awaitingOrderStatus && (
                    <View style={styles.notecontainer}>
                      <Text style={styles.noteTitle}>
                        Checking your order status
                      </Text>
                      <Text style={styles.noteText}>
                        Your orders have been submitted to your broker. We are
                        confirming them now — this screen updates on its own.
                        Please do not place them again.
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      paddingHorizontal: 10,
                      backgroundColor: designColor('fff'),
                    }}>
                    <SliderButton
                      loading={loading}
                      text={`Slide to Place Order || ₹ ${
                        totalAmount || '0.00'
                      }`}
                      onSlideComplete={onSlideComplete}
                      disabled={calculatedPortfolioData || awaitingOrderStatus}
                    />
                  </View>
                </GestureHandlerRootView>)
              ) : (
                // Show the TouchableOpacity button for other cases
                (<TouchableOpacity
                  style={[styles.actionButton, {backgroundColor: mainColor}]}
                  onPress={calculateRebalance}
                  disabled={loading || calculatedLoading}>
                  {loading || calculatedLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.buttonText}>Confirm Details</Text>
                  )}
                </TouchableOpacity>)
              )}
            </View>
          </View>
        )}
      </View>
      <BrokerSelectionModal
        showBrokerModal={BrokerModel}
        setShowBrokerModal={setBrokerModel}
        handleBrokerConnect={handleBrokerConnect}
        fetchBrokerStatusModal={fetchBrokerStatusModal}
        showIIFLModal={showIIFLModal}
        setShowIIFLModal={setShowIIFLModal}
        showICICIUPModal={showICICIUPModal}
        setShowICICIUPModal={setShowICICIUPModal}
        showupstoxModal={showupstoxModal}
        setShowupstoxModal={setShowupstoxModal}
        showangleoneModal={showangleoneModal}
        setShowangleoneModal={setShowangleoneModal}
        showzerodhamodal={showzerodhamodal}
        setShowzerodhaModal={setShowzerodhaModal}
        showhdfcModal={showhdfcModal}
        setShowhdfcModal={setShowhdfcModal}
        showDhanModal={showDhanModal}
        setShowDhanModal={setShowDhanModal}
        showKotakModal={showKotakModal}
        setShowKotakModal={setShowKotakModal}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    height: 48,
    paddingHorizontal: 12,
    paddingRight: 40,
    borderColor: designColor('d1d5db'),
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
  },
  calendarIcon: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{translateY: -12}],
    color: designColor('9ca3af'),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: designColor('fff'),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight / 2.1,
    padding: 15,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
  },
  modalHeader: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: designColor('e5e7eb'),
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Bold'),
    marginLeft: 5,
    color: 'black',
  },
  scrollContainer: {
    maxHeight: 400,
    alignContent: 'center',

    alignSelf: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: designColor('f5f5f5'),
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: designColor('d1d5db'),
  },
  tableHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: designColor('4b5563'),
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: designColor('d1d5db'),
  },
  tableRowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: designColor('4b5563'),
  },
  errorContainer: {
    paddingTop: 50,
    alignContent: 'center',
    alignSelf: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'black',
    textAlign: 'center',
  },
  subErrorText: {
    fontSize: 14,
    color: designColor('9ca3af'),
    fontFamily: designFont('Satoshi-Bold'),
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: designColor('e4e4e4'),
    flexDirection: 'row',
    backgroundColor: 'white',

    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'grey',
  },
  footerText1: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'black',
  },
  actionButton: {
    paddingVertical: 10,
    flex: 1,
    marginHorizontal: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: designFont('Satoshi-Bold'),
    marginBottom: 2,
    textAlign: 'center',
  },
  buttonDisabled: {
    backgroundColor: designColor('7f9cbf'),
  },
  notecontainer: {
    borderWidth: 1,
    borderColor: designColor('f9a825'),
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: designColor('fff'),
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: designColor('f9a825'),
    marginBottom: 4,
  },
  noteText: {
    fontSize: 11,
    color: designColor('333'),
    fontFamily: designFont('Satoshi-Regular'),
    lineHeight: 20,
  },
  header: {
    backgroundColor: designColor('f5f5f5'),
    borderTopWidth: 1,
    borderBottomWidth: 1,

    borderColor: designColor('00000010'),
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: designColor('00000010'),
    paddingVertical: 10,
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    fontSize: 12,

    fontFamily: designFont('Satoshi-Bold'),
    color: designColor('000'),
    textAlign: 'center',
  },
  cellText: {
    flex: 1,
    fontSize: 14,
    color: designColor('000'),
    fontFamily: designFont('Satoshi-Regular'),
    textAlign: 'center',
  },
  buyText: {
    fontFamily: designFont('Satoshi-Bold'),
    color: designColor('338d72'),
    fontSize: 14,
  },
  sellText: {
    fontFamily: designFont('Satoshi-Regular'),
    color: designColor('e43d3d'),
  },
  defaultText: {
    fontFamily: designFont('Satoshi-Regular'),
    color: designColor('16a085'),
  },
});
export default UserStrategySubscribeModal;
