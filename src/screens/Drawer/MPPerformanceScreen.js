import {availableFundsPayload} from '../../utils/fundingContinuation';
/**
 * MPPerformanceScreen — container (Phase I, 2026-05-02)
 *
 * Owns: useTrade, useConfig, useGstConfig, useNavigation, Firebase getAuth,
 * axios (getUserDetails, getStrategyDetails, getSingleStrategyDetails,
 * getAllStrategy, getSpecificPlan, getAllSubscriptionData, EDIS verification),
 * CryptoJS decryption, moment, fetchFunds, IsMarketHours, calculateRebalance,
 * EDIS state (7 booleans), subscription status, pricing options, consent state,
 * chart data (useMemo), convertResponse, EventEmitter.
 *
 * Resolves presentation from `screens.MPPerformanceScreen`.
 * Tab content, EDIS modals, and all child modals are passed as slots.
 */

import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {useParams} from 'react-router-native';
import axios from 'axios';
import moment from 'moment';
import CryptoJS from 'react-native-crypto-js';
import {getAuth} from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import Config from 'react-native-config';
import { useComponent } from '../../design/useDesign';

import server from '../../utils/serverConfig';
import {resolveImageUrl} from '../../utils/resolveImageUrl';
import {generateToken} from '../../utils/SecurityTokenManager';
import IsMarketHours from '../../utils/isMarketHours';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import {convertResponse} from '../../utils/tradeUtils';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {getAdvisorPlanColor} from '../../utils/advisorContentProfile';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';
import {useGstConfig} from '../../context/GstConfigContext';
import {withGst, gstLabel, recBase} from '../../utils/gstHelpers';

import PaymentSuccessModal from '../../components/ModelPortfolioComponents/PaymentSuccessModal';
import MPInvestNowModal from '../../components/ModelPortfolioComponents/MPInvestNowModal';
import MPReviewTradeModal from '../../components/ModelPortfolioComponents/MPReviewTradeModal';
import UserStrategySubscribeModal from '../../components/ModelPortfolioComponents/UserStrategySubscribeModal';
import RecommendationSuccessModal from '../../components/ModelPortfolioComponents/RecommendationSuccessModal';
import ConsentPopup from '../../components/ModelPortfolioComponents/ConsentPopUp';
import PerformanceChart from '../../components/ModelPortfolioComponents/PerformanceChart';
import PerformanceDisclaimer from '../../components/ModelPortfolioComponents/PerformanceDisclaimer';
import CustomTabBarMPPerformance from './CustomTabbarMPPerformance';
import EmptyStateInfoMP from './EmptyStateMP';
import DistributionGrid from './DistributionRowGrid';
import RebalanceTimeLineModal from '../../components/ModelPortfolioComponents/RebalanceTimelineModal';
import DdpiModal from '../../components/DdpiModal';
import {DhanTpinModal} from '../../components/DdpiModal';
import {AngleOneTpinModal} from '../../components/DdpiModal';
import {FyersTpinModal} from '../../components/DdpiModal';
import {OtherBrokerModel} from '../../components/DdpiModal';
import {FileText} from 'lucide-react-native';

import {getAccountEmail} from '../../utils/accountEmail';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { designColor, designFont } from '../../design/literalTokens';
import {sellOrdersForAuth} from '../../utils/sellAuthOrders';
const Alpha100 = require('../../assets/alpha-100.png');
const screenWidth = Dimensions.get('window').width;

const colorPalette = [
  designColor('eae7dc'), designColor('f5f3f4'), designColor('d4ecdd'), designColor('ffddc1'), designColor('f8e9a1'),
  designColor('b2c9ab'), designColor('ffc8a2'), designColor('f6bd60'), designColor('cb997e'), designColor('a5a58d'),
  designColor('b7cadb'), designColor('e2f0cb'), designColor('c1d37f'), designColor('ffebbb'), designColor('d3c4c4'),
  designColor('d4a5a5'), designColor('fff3e2'), designColor('f7b7a3'), designColor('efd6ac'), designColor('fae3d9'),
];

const entitlementKey = value =>
  String(value || '').toLowerCase().replace(/_/g, ' ').trim();

const firstMeaningful = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const firstPositive = (...values) =>
  values.find(value => Number.isFinite(Number(value)) && Number(value) > 0);

const MPPerformanceScreen = ({route}) => {
  const {modelName, specificPlan} = route.params;
  const {
    configData,
    modelPortfolioStrategyfinal,
    modelPortfolioEntitlementsLoaded,
  } = useTrade();
  const navigation = useNavigation();
  const {gstConfigure: configGst, gstWithTextConfigure: configGstWithText} = useGstConfig();
  const Presentation = useComponent('screens.MPPerformanceScreen');

  const appConfig = useConfig();
  const tokens = useTokens();
  // RA request (2026-08-13): the plan DETAIL surface must match the card the
  // user opened. When the tenant supplies plan colours (whitelabel/content.js
  // getMoneyManPlanColor — MAMM→green, MFCC→purple, MSRO→blue), resolve the
  // plan's identity color and thread it through the summary card gradient,
  // Save tag, tab bar, buttons and disclaimer accent instead of the brand
  // green. Identity-based (not position-based) — the detail screen shows
  // exactly one plan, so its color never changes with list order. Falls back
  // to the brand tokens for tenants without plan colours / unknown plans.
  const planColor = getAdvisorPlanColor(modelName);
  const gradient1 = planColor || tokens.colors.brand.gradientStart;
  const gradient2 = planColor || tokens.colors.brand.gradientEnd;
  const mainColor = planColor || tokens.colors.brand.primary;

  const auth = getAuth();
  const user = auth.currentUser;
  const {fileName} = useParams();
  const userEmail = getAccountEmail();

  // State
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [userDetails, setUserDetails] = useState();
  const [strategyDetails, setStrategyDetails] = useState({pieData: []});
  const [latestRebalance, setLatestRebalance] = useState(null);
  const [funds, setFunds] = useState({});
  const [broker, setBroker] = useState('');
  const [index, setIndex] = useState(0);
  const [openSuccessModal, setOpenSucessModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [orderPlacementResponse, setOrderPlacementResponse] = useState();
  const [lastSubmittedTrades, setLastSubmittedTrades] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [oneTimeAmount, setOneTimeAmount] = useState(null);
  const [selectedPlanType, setSelectedPlanType] = useState(null);
  const [oneTimeDurationPlan, setOneTimeDurationPlan] = useState(null);
  const [modalContext, setModalContext] = useState({
    specificPlan: null,
    specificPlanDetails: null,
    singleStrategyDetails: null,
    fileName: '',
  });
  const [showPaymentFail, setShowPaymentFail] = useState(false);
  const [researchWebViewUrl, setResearchWebViewUrl] = useState(null);

  // Overview first (index 0) so "View More" lands on Overview, not the
  // subscriber-locked Portfolio tab.
  const [routes] = useState([
    {key: 'overview', title: 'Overview'},
    {key: 'portfolio', title: 'Portfolio'},
    {key: 'research', title: 'Research'},
  ]);

  const [OpenSubscribeModel, setOpenSubscribeModel] = useState(false);
  const [openStrategy, setOpenStrategy] = useState(false);
  const [specificPlanDetails, setSpecificPlanDetails] = useState();
  const [namemodel, setnamemodel] = useState('');
  const [allStrategy, setAllStrategy] = useState([]);
  const [singleStrategyDetails, setSingleStrategyDetails] = useState();
  const [planDetails, setPlanDetails] = useState(null);

  // EDIS/DDPI state
  const [edisStatus, setEdisStatus] = useState(null);
  const [dhanEdisStatus, setDhanEdisStatus] = useState(null);
  const [showDdpiModal, setShowDdpiModal] = useState(false);
  const [showAngleOneTpinModel, setShowAngleOneTpinModel] = useState(false);
  const [showDhanTpinModel, setShowDhanTpinModel] = useState(false);
  const [showFyersTpinModal, setShowFyersTpinModal] = useState(false);
  const [showOtherBrokerModel, setShowOtherBrokerModel] = useState(false);
  const [isReturningFromOtherBrokerModal, setIsReturningFromOtherBrokerModal] = useState(false);
  const [calculatedPortfolioData, setCaluculatedPortfolioData] = useState([]);
  const [calculatedLoading, setCalculateLoading] = useState(false);
  const [BrokerModel, setBrokerModel] = useState(false);
  const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);

  // Consent
  const [globalConsent, setGlobalConsent] = useState(false);
  const [isConsentPopupOpen, setIsConsentPopupOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const overviewScrollRef = useRef(null);
  const performanceSectionOffset = useRef(0);
  const consentStorageKey = useMemo(
    () => `@app:mp-performance-consent:${entitlementKey(modelName)}`,
    [modelName],
  );

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(consentStorageKey)
      .then(value => { if (live && value === 'accepted') setGlobalConsent(true); })
      .catch(() => {});
    return () => { live = false; };
  }, [consentStorageKey]);

  // Pricing
  const [selectedPricing, setSelectedPricing] = useState(null);

  // Crypto helper
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

  // Resolve the ACTIVE broker's credentials from connected_brokers[] rather
  // than the legacy top-level single-broker fields. Multi-broker users (e.g.
  // Zerodha + DefinEdge) have per-broker creds in the array; the top-level
  // jwtToken/apiKey mirror only one broker and can be stale for the broker
  // being transacted. Fall back to top-level for back-compat.
  const _activeBrokerEntry = (userDetails?.connected_brokers || []).find(
    b => b?.broker === (userDetails?.user_broker || userDetails?.primary_broker),
  );
  const clientCode = _activeBrokerEntry?.clientCode ?? userDetails?.clientCode;
  const apiKey = _activeBrokerEntry?.apiKey ?? userDetails?.apiKey;
  const jwtToken = _activeBrokerEntry?.jwtToken ?? userDetails?.jwtToken;
  const secretKey = _activeBrokerEntry?.secretKey ?? userDetails?.secretKey;

  // Data fetching
  const getUserDetails = () => {
    if (userEmail) {
      axios
        .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(),
            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
          },
        })
        .then(res => setUserDetails(res.data.User))
        .catch(err => console.log(err));
    }
  };

  useEffect(() => { getUserDetails(); }, [userEmail]);
  useEffect(() => { setnamemodel(modelName); }, [modelName]);

  const getStrategyDetails = () => {
    if (namemodel) {
      axios
        .get(
          `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${namemodel?.replaceAll(/_/g, ' ')}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        )
        .then(res => {
          const portfolioData = res.data[0].originalData;
          setStrategyDetails(portfolioData);
          if (portfolioData?.model?.rebalanceHistory?.length > 0) {
            const latest = [...portfolioData.model.rebalanceHistory].sort(
              (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
            )[0];
            setLatestRebalance(latest);
          }
        })
        .catch(err => console.log(err));
    }
  };

  useEffect(() => { getStrategyDetails(); }, [namemodel]);

  const getSingleStrategyDetails = () => {
    if (namemodel) {
      axios
        .get(
          `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${namemodel}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        )
        .then(res => {
          const portfolioData = res.data[0].originalData;
          setModalContext(prev => ({ ...prev, singleStrategyDetails: portfolioData }));
          setSingleStrategyDetails(portfolioData);
          if (portfolioData?.model?.rebalanceHistory?.length > 0) {
            const latest = [...portfolioData.model.rebalanceHistory].sort(
              (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
            )[0];
            setLatestRebalance(latest);
          }
        })
        .catch(err => console.log(err));
    }
  };

  useEffect(() => { getSingleStrategyDetails(); }, [namemodel]);

  const getAllStrategy = () => {
    const reqConfig = {
      method: 'get',
      url: `${server.server.baseUrl}api/admin/plan/${configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain()}/model portfolio/${userEmail}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
      },
    };
    axios.request(reqConfig)
      .then(response => { setAllStrategy(response.data.data); })
      .catch(() => {});
  };

  useEffect(() => { getAllStrategy(); }, []);

  const getSpecificPlan = () => {
    if (specificPlan) {
      axios
        .get(
          `${server.server.baseUrl}api/admin/plan/detail/specific/${specificPlan._id}/${userEmail}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        )
        .then(res => {
          if (res.data?.data) {
            setStrategyDetails(res.data.data);
            setPlanDetails(res.data.data);
          }
        });
    }
  };

  useEffect(() => {
    if (specificPlan) { getSpecificPlan(); }
  }, [specificPlan]);

  // Broker + funds
  useEffect(() => {
    if (userDetails) { setBroker(userDetails.user_broker); }
  }, [userDetails]);

  useEffect(() => {
    const getAllFunds = async () => {
      const fetchedFunds = await fetchFunds(
        broker, userDetails?.clientCode, userDetails?.apiKey,
        userDetails?.jwtToken, userDetails?.secretKey,
        userDetails?.sid, userDetails?.serverId, userEmail,
      );
      setFunds(fetchedFunds || {});
    };
    if (broker && (userDetails?.clientCode || userDetails?.jwtToken)) {
      getAllFunds();
    }
  }, [broker, userDetails]);

  // EDIS verification
  useEffect(() => {
    if (!userDetails || !broker) return;
    const ccxtHeaders = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
      'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
    };
    if (broker === 'Angel One') {
      axios.post(`${server.ccxtServer.baseUrl}angelone/verify-edis`, {
        apiKey: checkValidApiAnSecret(apiKey),
        jwtToken: userDetails.jwtToken,
        userEmail: userDetails?.email,
      }, { headers: ccxtHeaders }).then(r => setEdisStatus(r.data)).catch(() => {});
    }
    if (broker === 'Dhan') {
      axios.post(`${server.ccxtServer.baseUrl}dhan/edis-status`, {
        clientId: clientCode,
        accessToken: userDetails.jwtToken,
      }, { headers: ccxtHeaders }).then(r => setDhanEdisStatus(r.data)).catch(() => {});
    }
    if (broker === 'Zerodha' && apiKey && secretKey) {
      axios.post(`${server.ccxtServer.baseUrl}zerodha/save-ddpi-status`, {
        apiKey: checkValidApiAnSecret(apiKey),
        secretKey: checkValidApiAnSecret(secretKey),
        accessToken: userDetails.jwtToken,
        userEmail: userDetails.email,
      }, { headers: ccxtHeaders }).catch(() => {});
    }
  }, [userDetails, broker]);

  // This is deliberately the same entitlement snapshot consumed by Home,
  // plan cards and Portfolio summary. `subscribed_by`, catalog subscription
  // metadata and historic holdings are not proof that a customer can receive
  // the current portfolio or its rebalance research reports.
  const hasActiveEntitlement = (modelPortfolioStrategyfinal || []).some(
    portfolio => entitlementKey(portfolio?.model_name) === entitlementKey(modelName),
  );
  const subscriptionStatus = !modelPortfolioEntitlementsLoaded
    ? 'checking'
    : hasActiveEntitlement
      ? 'active'
      : 'none';
  const isActive = subscriptionStatus === 'active';
  const subscribed = isActive;

  // Pricing options
  const getPricingOptions = () => {
    if (!specificPlan) return [];
    if (specificPlan?.amount) {
      return [{ label: `${specificPlan.duration} months`, value: specificPlan.amount, period: 'onetime' }];
    }
    const options = [];
    if (specificPlan?.planType === 'onetime' && Array.isArray(specificPlan.onetimeOptions)) {
      specificPlan.onetimeOptions.forEach((opt, idx) => {
        if (opt.amountWithoutGst > 0) {
          options.push({ period: `onetime-${idx}`, label: opt.label || `${opt.duration} days`, value: opt.amountWithoutGst });
        }
      });
    }
    const isValidPrice = p => p != null && !isNaN(Number(p)) && Number(p) > 0;
    [
      ['monthly', 'Monthly'],
      ['quarterly', 'Quarterly'],
      ['half-yearly', '6 Months'],
      ['yearly', 'Yearly'],
    ].forEach(([period, label]) => {
      const basePrice = recBase(specificPlan, period, configGst);
      if (isValidPrice(basePrice)) {
        options.push({period, label, value: basePrice});
      }
    });
    return options;
  };

  const pricingOptions = getPricingOptions();
  // Auto-preselect stops once the user taps a pricing option themselves.
  const userPickedPricingRef = useRef(false);

  useEffect(() => {
    if (userPickedPricingRef.current) return;
    // Backend attaches `subscribedPeriod` (derived from the subscription's paid
    // window) to the plan payload. Preselect the bought period instead of
    // defaulting to the FIRST option (Monthly). Falls back when unknown.
    const sp = specificPlan?.subscribedPeriod || planDetails?.subscribedPeriod;
    let preferred = null;
    if (sp) {
      if (sp.onetimeOptionIndex != null) {
        const m = pricingOptions.find(o => o.period === `onetime-${sp.onetimeOptionIndex}`);
        if (m) preferred = m.period;
      }
      if (!preferred && sp.periodKey) {
        const m = pricingOptions.find(o => o.period === sp.periodKey);
        if (m) preferred = m.period;
      }
    }
    if (!preferred && pricingOptions.length > 0) preferred = pricingOptions[0].period;
    if (preferred && preferred !== selectedPricing) {
      setSelectedPricing(preferred);
    }
  }, [pricingOptions, planDetails, selectedPricing, specificPlan]);

  const getCurrentPrice = () => {
    if (!specificPlan) return 0;
    if (specificPlan?.planType === 'onetime' && specificPlan?.onetimeOptions?.length > 0) {
      const sel = pricingOptions.find(opt => opt.period === selectedPricing);
      return Number(sel?.value ?? specificPlan.onetimeOptions[0].amountWithoutGst ?? 0);
    }
    if (specificPlan?.amount) return Number(specificPlan.amount);
    const sel = pricingOptions.find(opt => opt.period === selectedPricing);
    return Number(sel?.value ?? 0);
  };

  const currentPrice = getCurrentPrice();
  const displayPrice = configGst && configGstWithText ? withGst(currentPrice) : currentPrice;
  const gstLabelText = gstLabel(configGst, configGstWithText);
  const discount = specificPlan?.discountPercentage || 0;
  const originalPrice = discount > 0 ? Math.round(currentPrice / (1 - discount / 100)) : currentPrice;
  const nextRebalanceMoment = moment(singleStrategyDetails?.nextRebalanceDate);
  // A rebalance date in the past is historical context, not a future schedule.
  // Do not present it as "Next rebalance" until the manager publishes a new date.
  const nextRebalanceDate = nextRebalanceMoment.isValid() &&
    nextRebalanceMoment.endOf('day').isSameOrAfter(moment())
    ? nextRebalanceMoment.format('MMM DD, YYYY')
    : 'Schedule to be announced';

  // Invest button label
  const getInvestButtonLabel = () => {
    if (subscriptionStatus === 'active') return 'Subscribed';
    if (subscriptionStatus === 'renew') return 'Renew now';
    if (subscriptionStatus === 'expired') return 'Resubscribe';
    if (subscriptionStatus === 'checking') return 'Checking status…';
    return 'Invest now';
  };

  // Image. Plan.image is the authoritative logo (uploads write Plan first,
  // then mirror to ModelPortfolio). `specificPlan`/`planDetails` carry the Plan
  // doc with the CURRENT logo; `strategyDetails` may be overwritten ~2s later by
  // the slower /portfolios/strategy fetch returning a stale/empty
  // model_portfolio.image. Prefer the Plan image so a stale model_portfolio
  // image can't regress the header to the alpha-100 placeholder.
  const imageUri =
    resolveImageUrl(
      specificPlan?.image || planDetails?.image || strategyDetails?.image,
      server.server.baseUrl,
    ) || null;

  // Consent handlers
  const handleConsentAccept = useCallback(() => {
    setGlobalConsent(true);
    AsyncStorage.setItem(consentStorageKey, 'accepted').catch(() => {});
    setIsConsentPopupOpen(false);
    // Consent can originate from the summary while another tab is selected.
    // Always land the customer at the newly revealed, disclosure-led chart
    // instead of leaving it below the fold in Overview.
    setIndex(0);
    setTimeout(() => {
      overviewScrollRef.current?.scrollTo({
        y: Math.max(performanceSectionOffset.current - 8, 0),
        animated: true,
      });
    }, 350);
  }, [consentStorageKey]);
  const handleConsentOpen = useCallback(() => { setIsConsentPopupOpen(true); }, []);

  // Invest handlers
  const handleInvestNow = useCallback(() => { setPaymentModal(true); }, []);
  const closeInvestNowModal = () => { setPaymentModal(false); };
  const handleCardClickSelect = item => { setSelectedCard(item); };
  const onCloseReviewTrade = () => { setOpenStrategy(false); };
  const onClose = () => { setOpenSubscribeModel(false); };

  // calculateRebalance
  const calculateRebalance = (options = {}) => {
    setCalculateLoading(true);
    if (broker === undefined) {
      setBrokerModel(true);
      setCalculateLoading(false);
    } else if (funds?.status === 1 || funds?.status === 2 || funds === null) {
      setOpenTokenExpireModel(true);
      setCalculateLoading(false);
    } else {
      let payload = {
        userEmail, userBroker: broker,
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        userFund: options?.forceRefresh ? '0' : funds?.data?.availablecash,
        ...(options?.forceRefresh ? {forceRefresh: true} : {}),
        ...availableFundsPayload(options),
      };
      if (broker === 'IIFL Securities') payload.clientCode = clientCode;
      else if (broker === 'ICICI Direct') {
        payload.apiKey = checkValidApiAnSecret(apiKey);
        payload.secretKey = checkValidApiAnSecret(secretKey);
        payload.sessionToken = jwtToken;
      } else if (broker === 'Upstox') {
        payload.clientCode = clientCode;
        payload.apiKey = checkValidApiAnSecret(apiKey);
        payload.apiSecret = checkValidApiAnSecret(secretKey);
        payload.accessToken = jwtToken;
      } else if (broker === 'Angel One') {
        payload.apiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;
        payload.jwtToken = jwtToken;
      } else if (broker === 'Kotak') {
        payload.consumerKey = checkValidApiAnSecret(apiKey);
        payload.accessToken = jwtToken;
      } else if (broker === 'Hdfc Securities') {
        payload.apiKey = checkValidApiAnSecret(apiKey);
        payload.accessToken = jwtToken;
      }

      return axios.post(`${server.ccxtServer.baseUrl}rebalance/calculate`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
        },
      })
        .then(response => {
          if (response.data) {
            setCaluculatedPortfolioData(response.data);
            setCalculateLoading(false);
            setConfirmOrder(true);
          } else {
            setCaluculatedPortfolioData([]);
            setCalculateLoading(false);
            setConfirmOrder(false);
          }
        })
        .catch(() => { setCalculateLoading(false); });
    }
  };

  const dataArray = calculatedPortfolioData?.length !== 0
    ? [
        ...Object.entries(calculatedPortfolioData?.buy || {}).map(([symbol, qty]) => ({
          symbol, qty, orderType: 'BUY',
          exchange: symbol.endsWith('-EQ') ? 'NSE' : 'BSE',
        })),
        ...Object.entries(calculatedPortfolioData?.sell || {}).map(([symbol, qty]) => ({
          symbol, qty, orderType: 'SELL',
          exchange: symbol.endsWith('-EQ') ? 'NSE' : 'BSE',
        })),
      ]
    : [];

  const stockDetails = convertResponse(dataArray, broker);

  // Chart data
  const {chartData, colorMap} = useMemo(() => {
    const cMap = {};
    const data = latestRebalance?.adviceEntries?.map((entry, idx) => {
      const color = colorPalette[idx % colorPalette.length];
      cMap[entry.symbol] = color;
      return { shares: entry.symbol, value: entry.value * 100, fill: color };
    }) || [];
    return { chartData: data, colorMap: cMap };
  }, [latestRebalance]);

  // Research reports
  const researchReports = useMemo(
    () => strategyDetails?.model?.rebalanceHistory
      ?.filter(r => r.rr_link_mpf)
      ?.sort((a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate)) || [],
    [strategyDetails?.model?.rebalanceHistory],
  );

  // --- Render tab content ---
  // TabView treats each slot function as a component type. Keep their identity
  // stable across unrelated TradeContext/quote refreshes; otherwise every
  // parent render remounts PerformanceChart and repeats both CCXT requests.
  const PortfolioTab = useCallback(() => (
    <View style={{flex: 1, width: '100%', paddingHorizontal: 16}}>
      {isActive ? (
        <DistributionGrid
          adviceEntries={latestRebalance?.adviceEntries}
          type={'MPPerformanceScreen'}
        />
      ) : (
        <View style={{alignItems: 'flex-start', flex: 1}}>
          <EmptyStateInfoMP />
        </View>
      )}
    </View>
  ), [isActive, latestRebalance]);

  const OverviewTab = useCallback(({HeaderSlot} = {}) => (
    <View style={{flex: 1, backgroundColor: designColor('fff')}}>
      <ScrollView
        ref={overviewScrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40}}
      >
        {HeaderSlot ? <HeaderSlot /> : null}
        {/* Overview (methodology) shown FIRST; performance + its consent
            disclaimer moved to the bottom of this tab (see below). */}
        {(singleStrategyDetails?.definingUniverse ||
          singleStrategyDetails?.researchOverView ||
          singleStrategyDetails?.constituentScreening) && (
          <View style={{backgroundColor: designColor('fafafa'), borderRadius: 12, padding: 16}}>
            <Text style={{fontFamily: designFont('Poppins-SemiBold'), fontSize: 14, color: designColor('1a1a1a'), marginBottom: 12}}>
              Methodology
            </Text>
            {singleStrategyDetails?.definingUniverse ? (
              <>
                <Text style={methodStyles.head}>Defining the universe</Text>
                <Text style={methodStyles.body}>{singleStrategyDetails.definingUniverse}</Text>
              </>
            ) : null}
            {singleStrategyDetails?.researchOverView ? (
              <>
                <Text style={methodStyles.head}>Research</Text>
                <Text style={methodStyles.body}>{singleStrategyDetails.researchOverView}</Text>
              </>
            ) : null}
            {singleStrategyDetails?.constituentScreening ? (
              <>
                <Text style={methodStyles.head}>Constituent Screening</Text>
                <Text style={methodStyles.body}>{singleStrategyDetails.constituentScreening}</Text>
              </>
            ) : null}
            {singleStrategyDetails?.weighting ? (
              <>
                <Text style={methodStyles.head}>Weighting</Text>
                <Text style={methodStyles.body}>{singleStrategyDetails.weighting}</Text>
              </>
            ) : null}
            {singleStrategyDetails?.rebalanceMethodologyText ? (
              <>
                <Text style={methodStyles.head}>Rebalance</Text>
                <Text style={methodStyles.body}>{singleStrategyDetails.rebalanceMethodologyText}</Text>
              </>
            ) : null}
            {singleStrategyDetails?.assetAllocationText ? (
              <>
                <Text style={methodStyles.head}>Asset Allocation</Text>
                <Text style={methodStyles.body}>{singleStrategyDetails.assetAllocationText}</Text>
              </>
            ) : null}
          </View>
        )}

        {/* Performance section at the END of Overview — consent gate preserved:
            the (now shorter) disclaimer must be accepted before the chart shows. */}
        <View
          onLayout={event => {
            performanceSectionOffset.current = event.nativeEvent.layout.y;
          }}
          style={{marginTop: 24}}>
          <Text style={{fontFamily: designFont('Poppins-SemiBold'), fontSize: 14, color: designColor('1a1a1a'), marginBottom: 12}}>
            Performance
          </Text>
          {!globalConsent ? (
            <PerformanceDisclaimer onAccept={handleConsentAccept} accentColor={mainColor} />
          ) : (
            <PerformanceChart
              modelName={singleStrategyDetails?.model_name || modelName}
              advisor={singleStrategyDetails?.advisor}
            />
          )}
        </View>
      </ScrollView>
    </View>
  ), [globalConsent, handleConsentAccept, mainColor, modelName, singleStrategyDetails]);

  const ResearchTab = useCallback(() => (
    <View style={{flex: 1, backgroundColor: designColor('fff')}}>
      <View style={{paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: designColor('f0f0f0')}}>
        <Text style={{fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')}}>Research Reports</Text>
        <Text style={{fontSize: 11, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280')}}>
          {isActive
            ? 'Research reports for each rebalance'
            : 'Available with an active subscription'}
        </Text>
      </View>
      {!modelPortfolioEntitlementsLoaded ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32}}>
          <Text style={{fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')}}>Checking subscription status…</Text>
        </View>
      ) : !isActive ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32}}>
          <FileText size={32} color={designColor('9ca3af')} />
          <Text style={{fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937'), marginTop: 12, textAlign: 'center'}}>
            Research reports are included with this subscription
          </Text>
          <Text style={{fontSize: 12, lineHeight: 18, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginTop: 6, textAlign: 'center'}}>
            Subscribe to access the research report published for each rebalance.
          </Text>
          <TouchableOpacity
            onPress={handleInvestNow}
            style={{marginTop: 18, backgroundColor: mainColor, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8}}>
            <Text style={{fontSize: 12, fontFamily: designFont('Poppins-SemiBold'), color: designColor('fff')}}>View subscription options</Text>
          </TouchableOpacity>
        </View>
      ) : researchReports.length > 0 ? (
        <FlatList
          data={researchReports}
          keyExtractor={(item, idx) => item.model_Id || idx.toString()}
          contentContainerStyle={{padding: 12}}
          renderItem={({item}) => (
            <View
              style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginBottom: 8, backgroundColor: designColor('f9fafb'), borderRadius: 8, borderWidth: 1, borderColor: designColor('e5e7eb')}}
            >
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                <View style={{padding: 8, backgroundColor: designColor('fee2e2'), borderRadius: 8, marginRight: 12}}>
                  <FileText size={16} color={designColor('dc2626')} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 13, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')}}>
                    Rebalance Report - {moment(item.rebalanceDate).format('MMM DD, YYYY')}
                  </Text>
                  <Text style={{fontSize: 11, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280')}}>
                    Research report for this rebalance
                  </Text>
                </View>
              </View>
              <View
                style={{backgroundColor: mainColor, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6}}
                onTouchEnd={() => setResearchWebViewUrl(item.rr_link_mpf)}
              >
                <Text style={{fontSize: 11, fontFamily: designFont('Poppins-Medium'), color: designColor('fff')}}>View</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40}}>
          <FileText size={32} color={designColor('9ca3af')} />
          <Text style={{fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937'), marginTop: 12}}>No Research Reports</Text>
          <Text style={{fontSize: 12, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginTop: 4}}>No research reports available yet.</Text>
        </View>
      )}
    </View>
  ), [handleInvestNow, isActive, mainColor, modelPortfolioEntitlementsLoaded, researchReports]);

  return (
    <Presentation
      viewModel={{
        modelName,
        // Offering copy belongs to the exact Plan selected from the catalogue.
        // Fall back through the fetched plan and the enriched portfolio API for
        // legacy navigation payloads, then use overView only as a last resort.
        description:
          planDetails?.description ||
          specificPlan?.description ||
          strategyDetails?.planDescription ||
          strategyDetails?.overView ||
          '',
        gradient1,
        gradient2,
        mainColor,
        stepCompletedColor:
          planColor
            ? mainColor
            : appConfig?.paymentModal?.stepCompletedColor || designColor('58a100'),
        imageUri,
        fallbackImage: Alpha100,
        currentPrice: displayPrice,
        originalPrice,
        discount,
        gstLabel: gstLabelText,
        pricingOptions,
        selectedPricing,
        minInvestment: firstPositive(planDetails?.minInvestment, specificPlan?.minInvestment, strategyDetails?.minInvestment, singleStrategyDetails?.minInvestment),
        volatility: firstMeaningful(planDetails?.riskProfile, specificPlan?.riskProfile, strategyDetails?.riskProfile, singleStrategyDetails?.riskProfile, planDetails?.volatility, specificPlan?.volatility, strategyDetails?.volatility, singleStrategyDetails?.volatility),
        frequency: singleStrategyDetails?.frequency ?? strategyDetails?.frequency ?? planDetails?.frequency ?? specificPlan?.frequency,
        nextRebalanceDate,
        isSubscribed: subscribed,
        subscriptionStatus,
        isEntitlementLoading: !modelPortfolioEntitlementsLoaded,
        investButtonLabel: getInvestButtonLabel(),
        tabIndex: index,
        routes,
        isActive,
        researchWebViewUrl,
      }}
      actions={{
        onGoBack: () => navigation.goBack(),
        onSelectPricing: (period) => { userPickedPricingRef.current = true; setSelectedPricing(period); },
        onConsentOpen: handleConsentOpen,
        onTabIndexChange: setIndex,
        onInvestNow: handleInvestNow,
        onCloseResearchWebView: () => setResearchWebViewUrl(null),
      }}
      slots={{
        ConsentPopupSlot: (
          <ConsentPopup
            isConsentPopupOpen={isConsentPopupOpen}
            setIsConsentPopupOpen={setIsConsentPopupOpen}
            handleConsentAccept={handleConsentAccept}
          />
        ),
        PortfolioTabSlot: PortfolioTab,
        OverviewTabSlot: OverviewTab,
        ResearchTabSlot: ResearchTab,
        TabBarSlot: (props) => (
          <CustomTabBarMPPerformance accentColor={planColor || undefined} isSubscriptionActive={!isActive} {...props} />
        ),
        InvestNowModalSlot: paymentModal ? (
          <MPInvestNowModal
            visible={paymentModal}
            onClose={closeInvestNowModal}
            userEmail={userEmail}
            broker={broker}
            plans={planDetails}
            setShowPaymentFail={setShowPaymentFail}
            latestRebalance={latestRebalance}
            strategyDetails={planDetails}
            plandata={planDetails}
            handleCardClick={handleCardClickSelect}
            selectedCard={selectedCard}
            getStrategyDetails={() => getSingleStrategyDetails()}
            setPaymentSuccess={setPaymentSuccess}
            getAllStrategy={getAllStrategy}
            specificPlan={planDetails}
            specificPlanDetails={planDetails}
            setPaymentModal={setPaymentModal}
            userDetails={userDetails}
            fileName={modelName}
            isSubscribed={planDetails?.subscription}
            setOpenTokenExpireModel={setOpenTokenExpireModel}
            selectedPlanType={selectedPlanType}
            setSelectedPlanType={setSelectedPlanType}
            onetimeamount={oneTimeAmount}
            setOneTimeAmount={setOneTimeAmount}
            oneTimeDurationPlan={oneTimeDurationPlan}
            setOneTimeDurationPlan={setOneTimeDurationPlan}
            getAllBespoke={getSpecificPlan}
          />
        ) : null,
        PaymentSuccessSlot: paymentSuccess ? (
          <PaymentSuccessModal
            specificPlan={specificPlan}
            specificPlanDetails={specificPlan}
            setPaymentSuccess={setPaymentSuccess}
            setPaymentModal={setPaymentModal}
            setSelectedCard={setSelectedCard}
            setOpenSubscribeModel={setOpenSubscribeModel}
          />
        ) : null,
        ReviewTradeModalSlot: openStrategy ? (
          <MPReviewTradeModal
            visible={openStrategy}
            onCloseReviewTrade={onCloseReviewTrade}
            confirmOrder={confirmOrder}
            userEmail={userEmail}
            strategyDetails={strategyDetails}
            setconfirmOrder={setConfirmOrder}
            userDetails={userDetails}
            dataArray={latestRebalance?.adviceEntries}
            totalArray={dataArray}
            latestRebalance={latestRebalance}
            fileName={strategyDetails?.model_name}
            broker={broker}
            setOrderPlacementResponse={setOrderPlacementResponse}
            setLastSubmittedTrades={setLastSubmittedTrades}
            setOpenSubscribeModel={setOpenSubscribeModel}
            setOpenSucessModal={setOpenSucessModal}
            openSuccessModal={openSuccessModal}
            calculatedLoading={calculatedLoading}
            calculatedPortfolioData={calculatedPortfolioData}
            calculateRebalance={calculateRebalance}
            edisStatus={edisStatus}
            dhanEdisStatus={dhanEdisStatus}
            setShowDdpiModal={setShowDdpiModal}
            setShowAngleOneTpinModel={setShowAngleOneTpinModel}
            setShowDhanTpinModel={setShowDhanTpinModel}
            setShowFyersTpinModal={setShowFyersTpinModal}
            setShowOtherBrokerModel={setShowOtherBrokerModel}
            isReturningFromOtherBrokerModal={isReturningFromOtherBrokerModal}
            setIsReturningFromOtherBrokerModal={setIsReturningFromOtherBrokerModal}
          />
        ) : null,
        RecommendationSuccessSlot: openSuccessModal ? (
          <RecommendationSuccessModal
            openSuccessModal={openSuccessModal}
            setOpenSucessModal={setOpenSucessModal}
            orderPlacementResponse={orderPlacementResponse}
            originalStockDetails={lastSubmittedTrades}
            currentBroker={broker}
            userEmail={userEmail}
            modelId={latestRebalance?.model_Id}
            modelName={strategyDetails?.model_name}
            uniqueId={calculatedPortfolioData?.uniqueId}
          />
        ) : null,
        SubscribeModalSlot: OpenSubscribeModel && latestRebalance ? (
          <UserStrategySubscribeModal
            visible={OpenSubscribeModel}
            onClose={onClose}
            setOpenSubscribeModel={setOpenSubscribeModel}
            userEmail={userEmail}
            getStrategyDetails={getAllStrategy}
            strategyDetails={strategyDetails}
            fileName={fileName}
            latestRebalance={latestRebalance}
            userDetails={userDetails}
            setOpenSucessModal={setOpenSucessModal}
            setOrderPlacementResponse={setOrderPlacementResponse}
            setBrokerModel={setBrokerModel}
            BrokerModel={BrokerModel}
            clientCode={clientCode}
            apiKey={apiKey}
            secretKey={secretKey}
            jwtToken={jwtToken}
            broker={broker}
            setOpenTokenExpireModel={setOpenTokenExpireModel}
          />
        ) : null,
        DdpiModalSlot: showDdpiModal ? (
          <DdpiModal
            sellOrders={sellOrdersForAuth(orderPlacementResponse)}
            isOpen={showDdpiModal}
            setIsOpen={setShowDdpiModal}
            userDetails={userDetails}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
        AngelOneTpinSlot: showAngleOneTpinModel ? (
          <AngleOneTpinModal
            sellOrders={sellOrdersForAuth(orderPlacementResponse)}
            isOpen={showAngleOneTpinModel}
            setIsOpen={setShowAngleOneTpinModel}
            userDetails={userDetails}
            edisStatus={edisStatus}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
        DhanTpinSlot: showDhanTpinModel ? (
          <DhanTpinModal
            sellOrders={sellOrdersForAuth(orderPlacementResponse)}
            isOpen={showDhanTpinModel}
            setIsOpen={setShowDhanTpinModel}
            userDetails={userDetails}
            dhanEdisStatus={dhanEdisStatus}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
            onEdisStatusRefresh={setDhanEdisStatus}
          />
        ) : null,
        FyersTpinSlot: showFyersTpinModal ? (
          <FyersTpinModal
            sellOrders={sellOrdersForAuth(orderPlacementResponse)}
            isOpen={showFyersTpinModal}
            setIsOpen={setShowFyersTpinModal}
            userDetails={userDetails}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
        OtherBrokerSlot: showOtherBrokerModel ? (
          <OtherBrokerModel
            sellOrders={sellOrdersForAuth(orderPlacementResponse)}
            userDetails={userDetails}
            onContinue={() => {
              setIsReturningFromOtherBrokerModal(true);
              setShowOtherBrokerModel(false);
            }}
            visible={showOtherBrokerModel}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
      }}
    />
  );
};

const methodStyles = {
  head: {
    color: 'rgba(0, 0, 0, 0.85)',
    fontSize: 12,
    fontFamily: designFont('Poppins-SemiBold'),
    marginTop: 14,
    marginBottom: 4,
  },
  body: {
    color: 'rgba(0, 0, 0, 0.7)',
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    lineHeight: 18,
  },
};

export default MPPerformanceScreen;
