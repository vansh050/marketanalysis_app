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

import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  FlatList,
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
import {generateToken} from '../../utils/SecurityTokenManager';
import IsMarketHours from '../../utils/isMarketHours';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import {convertResponse} from '../../utils/tradeUtils';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {useGstConfig} from '../../context/GstConfigContext';
import {withGst, gstLabel} from '../../utils/gstHelpers';
import {getSubscriptionStatusString} from '../../utils/subscriptionStatus';

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

const Alpha100 = require('../../assets/alpha-100.png');
const screenWidth = Dimensions.get('window').width;

const colorPalette = [
  '#EAE7DC', '#F5F3F4', '#D4ECDD', '#FFDDC1', '#F8E9A1',
  '#B2C9AB', '#FFC8A2', '#F6BD60', '#CB997E', '#A5A58D',
  '#B7CADB', '#E2F0CB', '#C1D37F', '#FFEBBB', '#D3C4C4',
  '#D4A5A5', '#FFF3E2', '#F7B7A3', '#EFD6AC', '#FAE3D9',
];

const MPPerformanceScreen = ({route}) => {
  const {modelName, specificPlan} = route.params;
  const {configData} = useTrade();
  const navigation = useNavigation();
  const {gstConfigure: configGst, gstWithTextConfigure: configGstWithText} = useGstConfig();
  const Presentation = useComponent('screens.MPPerformanceScreen');

  const appConfig = useConfig();
  const gradient1 = appConfig?.gradient1 || '#002651';
  const gradient2 = appConfig?.gradient2 || '#0076fb';
  const mainColor = appConfig?.mainColor || '#0056B7';

  const auth = getAuth();
  const user = auth.currentUser;
  const {fileName} = useParams();
  const userEmail = user && user.email;

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

  const [routes] = useState([
    {key: 'portfolio', title: 'Portfolio'},
    {key: 'overview', title: 'OverView'},
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

  // Subscription data
  const [subscriptionData, setSubscriptionData] = useState([]);

  // Pricing
  const [selectedPricing, setSelectedPricing] = useState(null);

  // Crypto helper
  const checkValidApiAnSecret = data => {
    if (!data) return null;
    try {
      const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
      const Key = bytesKey.toString(CryptoJS.enc.Utf8);
      return Key || null;
    } catch (error) {
      return null;
    }
  };

  const clientCode = userDetails?.clientCode;
  const apiKey = userDetails?.apiKey;
  const jwtToken = userDetails?.jwtToken;
  const secretKey = userDetails?.secretKey;

  // Data fetching
  const getUserDetails = () => {
    if (userEmail) {
      axios
        .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getAdvisorSubdomain(),
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

  // Subscription data
  const getAllSubscriptionData = () => {
    axios.get(`${server.server.baseUrl}api/all-clients/user/${userEmail}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
      },
    }).then(r => setSubscriptionData(r.data.data)).catch(() => {});
  };
  useEffect(() => { getAllSubscriptionData(); }, []);

  // Shared util — consults subscriptionData.groups before subscriptions
  // (web parity, prod-alphaquark-github/src/Home/PricingSection/IPOCard.js
  // hasActiveSubscription). Pass the FULL subscriptionData object so the
  // groups branch can fire; the previous inline copy only looked at
  // `.subscriptions` and produced false-positives for plans the user
  // never subscribed to.
  const subscriptionStatus = getSubscriptionStatusString(modelName, subscriptionData);
  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'renew';
  // Defend against backend variants that return `subscribed_by` as something
  // other than an array (alphanomy tenant has surfaced it as an object on
  // some plans, which threw `.filter is not a function`). Treat anything
  // non-array as no subscribers.
  const subscribed = Array.isArray(planDetails?.subscribed_by)
    && planDetails.subscribed_by.some(email => email === userEmail);

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
    if (isValidPrice(specificPlan?.pricingWithoutGst?.monthly))
      options.push({ period: 'monthly', label: 'Monthly', value: specificPlan.pricingWithoutGst.monthly });
    if (isValidPrice(specificPlan?.pricingWithoutGst?.quarterly))
      options.push({ period: 'quarterly', label: 'Quarterly', value: specificPlan.pricingWithoutGst.quarterly });
    if (isValidPrice(specificPlan?.pricingWithoutGst?.['half-yearly']))
      options.push({ period: 'half-yearly', label: '6 Months', value: specificPlan.pricingWithoutGst['half-yearly'] });
    if (isValidPrice(specificPlan?.pricing?.yearly))
      options.push({ period: 'yearly', label: 'Yearly', value: specificPlan.pricing.yearly });
    return options;
  };

  const pricingOptions = getPricingOptions();

  useEffect(() => {
    if (pricingOptions.length > 0 && !pricingOptions.find(opt => opt.period === selectedPricing)) {
      setSelectedPricing(pricingOptions[0].period);
    }
  }, [pricingOptions]);

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

  // Volatility color
  const getVolatilityColorStyle = () => {
    if (!globalConsent) return { color: '#9CA3AF' };
    const v = strategyDetails?.volatility;
    if (typeof v === 'number') {
      if (v > 0.15) return { color: '#DC2626' };
      if (v > 0.1) return { color: '#F59E0B' };
      return { color: '#16A34A' };
    }
    if (v === 'High') return { color: '#DC2626' };
    if (v === 'Medium') return { color: '#F59E0B' };
    if (v === 'Low') return { color: '#16A34A' };
    return { color: '#9CA3AF' };
  };

  const getCagrDisplay = () => {
    if (!globalConsent) return 'View';
    if (strategyDetails?.performance_data?.returns?.cagr) {
      return `${strategyDetails.performance_data.returns.cagr.toFixed(2)}%`;
    }
    return 'New Portfolio';
  };

  // Invest button label
  const getInvestButtonLabel = () => {
    if (subscriptionStatus === 'active') return 'Subscribed';
    if (subscriptionStatus === 'renew') return 'Renew now';
    if (subscriptionStatus === 'expired') return 'Resubscribe';
    return 'Invest now';
  };

  // Image
  const imageUri = strategyDetails?.image
    ? `${server.server.baseUrl}${strategyDetails.image}`
    : null;

  // Consent handlers
  const handleConsentAccept = () => { setGlobalConsent(true); setIsConsentPopupOpen(false); };
  const handleConsentOpen = () => { setIsConsentPopupOpen(true); };

  // Invest handlers
  const handleInvestNow = () => { setPaymentModal(true); };
  const closeInvestNowModal = () => { setPaymentModal(false); };
  const handleCardClickSelect = item => { setSelectedCard(item); };
  const onCloseReviewTrade = () => { setOpenStrategy(false); };
  const onClose = () => { setOpenSubscribeModel(false); };

  // calculateRebalance
  const calculateRebalance = () => {
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
        userFund: funds?.data?.availablecash,
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

      axios.post(`${server.ccxtServer.baseUrl}rebalance/calculate`, payload, {
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
  const researchReports = strategyDetails?.model?.rebalanceHistory
    ?.filter(r => r.rr_link_mpf)
    ?.sort((a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate)) || [];

  // --- Render tab content ---
  const PortfolioTab = () => (
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
  );

  const OverviewTab = () => (
    <View style={{flex: 1, backgroundColor: '#fff'}}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40}}
      >
        {!globalConsent ? (
          <PerformanceDisclaimer onAccept={handleConsentAccept} accentColor={mainColor} />
        ) : (
          <PerformanceChart
            modelName={singleStrategyDetails?.model_name || modelName}
            advisor={singleStrategyDetails?.advisor}
          />
        )}
        {(singleStrategyDetails?.definingUniverse ||
          singleStrategyDetails?.researchOverView ||
          singleStrategyDetails?.constituentScreening) && (
          <View style={{marginTop: 24, backgroundColor: '#fafafa', borderRadius: 12, padding: 16}}>
            <Text style={{fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#1a1a1a', marginBottom: 12}}>
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
      </ScrollView>
    </View>
  );

  const ResearchTab = () => (
    <View style={{flex: 1, backgroundColor: '#fff'}}>
      <View style={{paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'}}>
        <Text style={{fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#1F2937'}}>Research Reports</Text>
        <Text style={{fontSize: 11, fontFamily: 'Poppins-Regular', color: '#6B7280'}}>Research reports for each rebalance</Text>
      </View>
      {researchReports.length > 0 ? (
        <FlatList
          data={researchReports}
          keyExtractor={(item, idx) => item.model_Id || idx.toString()}
          contentContainerStyle={{padding: 12}}
          renderItem={({item}) => (
            <View
              style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginBottom: 8, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB'}}
            >
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                <View style={{padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8, marginRight: 12}}>
                  <FileText size={16} color="#DC2626" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#1F2937'}}>
                    Rebalance Report - {moment(item.rebalanceDate).format('MMM DD, YYYY')}
                  </Text>
                  <Text style={{fontSize: 11, fontFamily: 'Poppins-Regular', color: '#6B7280'}}>
                    Research report for this rebalance
                  </Text>
                </View>
              </View>
              <View
                style={{backgroundColor: mainColor, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6}}
                onTouchEnd={() => setResearchWebViewUrl(item.rr_link_mpf)}
              >
                <Text style={{fontSize: 11, fontFamily: 'Poppins-Medium', color: '#fff'}}>View</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40}}>
          <FileText size={32} color="#9CA3AF" />
          <Text style={{fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#1F2937', marginTop: 12}}>No Research Reports</Text>
          <Text style={{fontSize: 12, fontFamily: 'Poppins-Regular', color: '#6B7280', marginTop: 4}}>No research reports available yet.</Text>
        </View>
      )}
    </View>
  );

  return (
    <Presentation
      viewModel={{
        modelName,
        gradient1,
        gradient2,
        mainColor,
        stepCompletedColor: appConfig?.paymentModal?.stepCompletedColor || '#58a100',
        imageUri,
        fallbackImage: Alpha100,
        currentPrice: displayPrice,
        originalPrice,
        discount,
        gstLabel: gstLabelText,
        pricingOptions,
        selectedPricing,
        minInvestment: singleStrategyDetails?.minInvestment,
        volatility: strategyDetails?.volatility,
        volatilityColorStyle: getVolatilityColorStyle(),
        cagrDisplay: getCagrDisplay(),
        cagrClickable: !globalConsent,
        globalConsent,
        frequency: singleStrategyDetails?.frequency,
        nextRebalanceDate: moment(singleStrategyDetails?.nextRebalanceDate).format('MMM DD, YYYY'),
        isSubscribed: subscribed,
        subscriptionStatus,
        investButtonLabel: getInvestButtonLabel(),
        tabIndex: index,
        routes,
        isActive,
        researchWebViewUrl,
      }}
      actions={{
        onGoBack: () => navigation.goBack(),
        onSelectPricing: setSelectedPricing,
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
          <CustomTabBarMPPerformance isSubscriptionActive={!isActive} {...props} />
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
            isOpen={showDdpiModal}
            setIsOpen={setShowDdpiModal}
            userDetails={userDetails}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
        AngelOneTpinSlot: showAngleOneTpinModel ? (
          <AngleOneTpinModal
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
            isOpen={showDhanTpinModel}
            setIsOpen={setShowDhanTpinModel}
            userDetails={userDetails}
            dhanEdisStatus={dhanEdisStatus}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
        FyersTpinSlot: showFyersTpinModal ? (
          <FyersTpinModal
            isOpen={showFyersTpinModal}
            setIsOpen={setShowFyersTpinModal}
            userDetails={userDetails}
            reopenRebalanceModal={() => {}}
            getUserDetails={getUserDetails}
          />
        ) : null,
        OtherBrokerSlot: showOtherBrokerModel ? (
          <OtherBrokerModel
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
    fontFamily: 'Poppins-SemiBold',
    marginTop: 14,
    marginBottom: 4,
  },
  body: {
    color: 'rgba(0, 0, 0, 0.7)',
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    lineHeight: 18,
  },
};

export default MPPerformanceScreen;
