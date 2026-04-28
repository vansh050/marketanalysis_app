import React, {useState, useEffect, useMemo, useRef} from 'react';
import {useParams} from 'react-router-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import PaymentSuccessModal from '../../components/ModelPortfolioComponents/PaymentSuccessModal';
import PieChart from 'react-native-pie-chart';
import {TabView, SceneMap, TabBar} from 'react-native-tab-view';
import Icon from 'react-native-vector-icons/FontAwesome';
import UserStrategySubscribeModal from '../../components/ModelPortfolioComponents/UserStrategySubscribeModal';
import moment from 'moment';
import IsMarketHours from '../../utils/isMarketHours';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import CryptoJS, {mode} from 'react-native-crypto-js';

import {
  TrendingUpIcon,
  CandlestickChart,
  Timer,
  Gauge,
  ChevronLeft,
  TrendingUp,
  Info,
  CheckCircle,
  Star,
} from 'lucide-react-native';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import EmptyMP from '../../assets/emptyModelPortfolio.svg';
import RebalanceTimeLineModal from '../../components/ModelPortfolioComponents/RebalanceTimelineModal';
const Alpha100 = require('../../assets/alpha-100.png');
const speed = require('../../assets/speed.png');
import {useNavigation} from '@react-navigation/native';
const screenWidth = Dimensions.get('window').width;
const ScreenHeight = Dimensions.get('window').height;
import MPInvestNowModal from '../../components/ModelPortfolioComponents/MPInvestNowModal';
import MPReviewTradeModal from '../../components/ModelPortfolioComponents/MPReviewTradeModal';
import eventEmitter from '../../components/EventEmitter';
import RecommendationSuccessModal from '../../components/ModelPortfolioComponents/RecommendationSuccessModal';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import Animated from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import CustomTabBarOrder from './CustomTabbarOrder';
import PerformanceChart from '../../components/ModelPortfolioComponents/PerformanceChart';
import CustomTabBarMPPerformance from './CustomTabbarMPPerformance';
import EmptyStateInfoMP from './EmptyStateMP';
import ConsentPopup from '../../components/ModelPortfolioComponents/ConsentPopUp';
import DistributionGrid from './DistributionRowGrid';
import {useTrade} from '../TradeContext';
import {convertResponse} from '../../utils/tradeUtils';
import {useGstConfig} from '../../context/GstConfigContext';
import {withGst, gstLabel} from '../../utils/gstHelpers';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
const colorPalette = [
  '#EAE7DC',
  '#F5F3F4',
  '#D4ECDD',
  '#FFDDC1',
  '#F8E9A1',
  '#B2C9AB',
  '#FFC8A2',
  '#F6BD60',
  '#CB997E',
  '#A5A58D',
  '#B7CADB',
  '#E2F0CB',
  '#C1D37F',
  '#FFEBBB',
  '#D3C4C4',
  '#D4A5A5',
  '#FFF3E2',
  '#F7B7A3',
  '#EFD6AC',
  '#FAE3D9',
];

const Distribution = ({
  latestRebalance,
  colorMap,
  isValidData,
  chartData,
  strategyDetails,
  singleStrategyDetails,
}) => {
  const [showRebalanceTimelineModal, setShowRebalanceTimelineModal] =
    useState(false);
  const closeRebalanceTimelineModal = () => {
    setShowRebalanceTimelineModal(false);
  };

  // Convert chartData to seriesData
  const seriesData = chartData.map(entry => Number(entry.value));
  // Check if seriesData is valid
  const renderModelPortfolio = () => (
    <View style={styles.emptyContainer}>
      <EmptyMP />
      <Text style={styles.noDataText}>No Data Found</Text>
      <Text style={styles.noDataSubtitle}>
        Explore our curated Model Portfolios and start investing today!
      </Text>
    </View>
  );

  // Conditional rendering based on the availability of seriesData
  if (seriesData.length === 0) {
    return renderModelPortfolio();
  }

  return (
    <View style={{flex: 1, paddingHorizontal: 10}}>
      <View style={{marginTop: 20, marginHorizontal: 10}}>
        <Text style={{color: 'grey', fontFamily: 'Satoshi-Regular'}}>
          Click to view the{' '}
          <Text
            onPress={() => setShowRebalanceTimelineModal(true)}
            style={{color: '#3B82F6'}}>
            latest rebalance updates{' '}
          </Text>
          and history.
        </Text>
      </View>

      {/* <View style={styles.rebalanceContainer}>
        <View style={{ paddingHorizontal: 15, }}>
          <Text style={styles.rebalanceLabel}>Last Rebalance</Text>
          <Text style={styles.rebalanceDate}>{moment(singleStrategyDetails?.last_updated).format(
            "MMM DD, YYYY"
          )}
          </Text>
        </View>
        <View style={styles.rebalanceDetails}>
          <Text style={styles.rebalanceLabel}>Next Rebalance</Text>
          <Text style={styles.rebalanceDate}>{
            singleStrategyDetails?.nextRebalanceDate && moment(singleStrategyDetails.nextRebalanceDate).isBefore(moment())
              ? 'Rebalance due'
              : moment(singleStrategyDetails?.nextRebalanceDate).format("MMM DD, YYYY")
          }
          </Text>
        </View>

        <View style={{ paddingHorizontal: 15, }}>
          <Text style={styles.rebalanceLabel}>Rebalance</Text>
          <Text style={styles.rebalanceFrequency}>{singleStrategyDetails?.frequency}</Text>
        </View>
      </View> */}

      {/* Equity and Weightage Section */}
      <View style={{marginTop: 30, marginHorizontal: 10}}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
          <Text
            style={{
              color: 'black',
              fontFamily: 'Satoshi-Regular',
              fontSize: 14,
            }}>
            Equity
          </Text>
          <Text
            style={{
              color: 'black',
              fontFamily: 'Satoshi-Regular',
              fontSize: 14,
            }}>
            Weightage (%)
          </Text>
        </View>

        <FlatList
          data={latestRebalance?.adviceEntries}
          renderItem={({item}) => (
            <View
              style={[
                styles.equityItem,
                {borderLeftColor: colorMap[item.symbol]},
              ]}>
              <Text
                style={{
                  color: 'black',
                  fontFamily: 'Satoshi-Regular',
                  fontSize: 16,
                  marginLeft: 10,
                }}>
                {item.symbol}
              </Text>
              <Text
                style={{
                  color: 'black',
                  fontFamily: 'Satoshi-Regular',
                  marginRight: 10,
                }}>
                {(item.value * 100).toFixed(2)}
              </Text>
            </View>
          )}
          keyExtractor={(item, index) => index.toString()}
        />
      </View>

      {/* Pie Chart Section */}
      <View
        style={{
          alignSelf: 'center',
          justifyContent: 'center',
          marginVertical: 10,
        }}>
        <PieChart
          widthAndHeight={250}
          series={seriesData}
          sliceColor={chartData.map(entry => entry.fill)}
          coverRadius={0.01}
          coverFill={'#FFF'}
        />
      </View>
      {showRebalanceTimelineModal && (
        <RebalanceTimeLineModal
          closeRebalanceTimelineModal={closeRebalanceTimelineModal}
          strategyDetails={strategyDetails}
        />
      )}
    </View>
  );
};

const BespokePerformanceScreen = ({route}) => {
  const {modelName, specificPlan} = route.params;
  const {configData} = useTrade();
  const navigation = useNavigation();
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  const auth = getAuth();
  const user = auth.currentUser;
  const {fileName} = useParams();
  const userEmail = user && user.email;
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [userDetails, setUserDetails] = useState();
  const [strategyDetails, setStrategyDetails] = useState({pieData: []});
  const [latestRebalance, setLatestRebalance] = useState(null);
  const [funds, setFunds] = useState({});
  const [broker, setBroker] = useState('');
  const [index, setIndex] = useState(0);
  const [tabHeights, setTabHeights] = useState([0, 0, 0]);
  const [showRebalanceTimelineModal, setShowRebalanceTimelineModal] =
    useState(false);
  const [openSuccessModal, setOpenSucessModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [orderPlacementResponse, setOrderPlacementResponse] = useState();
  const closeRebalanceTimelineModal = () => {
    setShowRebalanceTimelineModal(false);
  };
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
  const handleTabLayout = index => event => {
    const {height} = event.nativeEvent.layout;
    setTabHeights(prev => {
      const newHeights = [...prev];
      newHeights[index] = height;

      return newHeights;
    });
  };

  const [routes] = useState([
    {key: 'keyfeatures', title: 'Key Features'},
    {key: 'overview', title: 'OverView'},
  ]);
  // Prepare chart data, config, and color mapping using useMemo
  const {chartData, chartConfig, colorMap} = useMemo(() => {
    const colorMap = {};
    const data =
      latestRebalance?.adviceEntries?.map((entry, index) => {
        const color = colorPalette[index % colorPalette.length];
        colorMap[entry.symbol] = color;
        return {
          shares: entry.symbol,
          value: entry.value * 100,
          fill: color,
        };
      }) || [];

    const config = {
      value: {label: 'Equity Distribution'},
      ...data.reduce((acc, entry) => {
        acc[entry.shares] = {
          label: entry.shares,
          color: entry.fill,
        };
        return acc;
      }, {}),
    };

    return {chartData: data, chartConfig: config, colorMap};
  }, [latestRebalance, colorPalette]);

  const [OpenSubscribeModel, setOpenSubscribeModel] = useState(false); // State for modal visibility
  const [openStrategy, setOpenStrategy] = useState(false);
  const [specificPlanDetails, setSpecificPlanDetails] = useState();
  const handleInvestNow = () => {
    setPaymentModal(true);
    // Open the modal when "Invest Now" is clicked
  };
  const handleInvestAmountChange = newAmount => {
    setInvestAmount(newAmount); // Update local state
    navigation.setParams({invetAmount: newAmount}); // Update params in route
  };
  const closeInvestNowModal = () => {
    setPaymentModal(false); // Close the modal
  };
  const onCloseReviewTrade = () => {
    setOpenStrategy(false); // Close the modal
  };

  const [namemodel, setnamemodel] = useState('');
  const [allStrategy, setAllStrategy] = useState([]);
  useEffect(() => {
    const getUserDetails = () => {
      if (userEmail) {
        axios
          .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getAdvisorSubdomain(),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          })
          .then(res => setUserDetails(res.data.User))
          .catch(err => console.log(err));
      }
    };
    getUserDetails();
  }, [userEmail]);
  const getStrategyDetails = () => {
    if (namemodel !== null) {
      axios
        .get(
          `${
            server.server.baseUrl
          }api/model-portfolio/portfolios/strategy/${namemodel?.replaceAll(
            /_/g,
            ' ',
          )}`,
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
          const portfolioData = res.data[0].originalData;
          setStrategyDetails(portfolioData);
          if (
            portfolioData &&
            portfolioData.model &&
            portfolioData.model.rebalanceHistory.length > 0
          ) {
            const latest = [...portfolioData.model.rebalanceHistory].sort(
              (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
            )[0];
            console.log('Latest Rebalance:', latest);
            setLatestRebalance(latest);
          }
        })
        .catch(err => console.log(err));
    }
  };

  useEffect(() => {
    setnamemodel(modelName);
  }, [modelName]);

  useEffect(() => {
    getStrategyDetails();
  }, [namemodel]);

  const [singleStrategyDetails, setSingleStrategyDetails] = useState();
  const getSingleStrategyDetails = () => {
    if (namemodel !== null) {
      axios
        .get(
          `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${namemodel}`,
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
          const portfolioData = res.data[0].originalData;
          setModalContext(prev => ({
            ...prev,
            singleStrategyDetails: portfolioData,
          }));
          console.log('Inside :', portfolioData);
          setSingleStrategyDetails(portfolioData);
          if (
            portfolioData &&
            portfolioData.model &&
            portfolioData.model.rebalanceHistory.length > 0
          ) {
            const latest = [...portfolioData.model.rebalanceHistory].sort(
              (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
            )[0];
            setLatestRebalance(latest);
          }
        })
        .catch(err => console.log(err));
    }
  };

  useEffect(() => {
    getSingleStrategyDetails();
  }, [namemodel]);

  const getAllStrategy = () => {
    let config = {
      method: 'get',
      url: `${server.server.baseUrl}api/admin/plan/${configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain()}/model portfolio/${userEmail}`,

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
        // console.log("res MOdel Portfolio url", `${server.server.baseUrl}api/admin/plan/${configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain()}/model portfolio/${userEmail}`);
        setAllStrategy(response.data.data);

        setIsLoading(false);
      })
      .catch(error => {
        //  console.log(error);
      });
  };

  useEffect(() => {
    getAllStrategy();
  }, []);

  const handleCardClickSelect = item => {
    console.log('Itemsmsss:', item);
    setSelectedCard(item); // Set the selected card
    // Call your subscribe function
  };
  console.log('Single Strategy-----------', singleStrategyDetails);
  useEffect(() => {
    if (userDetails) {
      setBroker(userDetails.user_broker);
    }
  }, [userDetails]);
  useEffect(() => {
    const getAllFunds = async () => {
      const fetchedFunds = await fetchFunds(
        broker,
        userDetails?.clientCode,
        userDetails?.apiKey,
        userDetails?.jwtToken,
        userDetails?.secretKey,
        userDetails?.sid,
        userDetails?.serverId,
        userEmail,
      );
      setFunds(fetchedFunds || {});
    };

    if (broker && (userDetails?.clientCode || userDetails?.jwtToken)) {
      getAllFunds();
    }
  }, [broker, userDetails]);
  const subscribed =
    planDetails?.subscribed_by?.filter(email => email === userEmail).length > 0;

  const clientCode = userDetails && userDetails?.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const jwtToken = userDetails && userDetails?.jwtToken;
  const my2pin = userDetails && userDetails?.my2Pin;
  const secretKey = userDetails && userDetails?.secretKey;
  const userId = userDetails && userDetails?._id;
  const mobileNumber = userDetails && userDetails?.phone_number;
  const panNumber = userDetails && userDetails?.panNumber;

  const [calculatedPortfolioData, setCaluculatedPortfolioData] = useState([]);
  const [calculatedLoading, setCalculateLoading] = useState(false);
  const [BrokerModel, setBrokerModel] = useState(false);
  const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    try {
      const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
      const Key = bytesKey.toString(CryptoJS.enc.Utf8);
      if (Key) {
        return Key;
      } else {
        throw new Error('Invalid Key');
      }
    } catch (error) {
      return null;
    }
  };

  const calculateRebalance = () => {
    const isMarketHours = IsMarketHours();
    setCalculateLoading(true);
    if (broker === undefined) {
      setBrokerModel(true);
      setCalculateLoading(false);
    } else if (funds?.status === 1 || funds?.status === 2 || funds === null) {
      // Funds check matching web frontend: status 1/2 = token issue, null = error
      setOpenTokenExpireModel(true);
      setCalculateLoading(false);
    }
    //   else if (!isMarketHours) {
    //   setCalculateLoading(false);
    //   toast.error("Orders cannot be placed after Market hours.", {
    //     duration: 3000,
    //     style: {
    //       background: "white",
    //       color: "#1e293b",
    //       maxWidth: "500px",
    //       fontWeight: 600,
    //       fontSize: "13px",
    //       padding: "10px 20px",
    //     },
    //     iconTheme: {
    //       primary: "#e43d3d",
    //       secondary: "#FFFAEE",
    //     },
    //   });
    //   return;
    // }
    else {
      let payload = {
        userEmail: userEmail,
        userBroker: broker,
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        userFund: funds?.data?.availablecash,
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
          sessionToken: jwtToken,
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
          serverId: serverId,
        };
      } else if (broker === 'Hdfc Securities') {
        payload = {
          ...payload,
          apiKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
        };
      }

      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/calculate`,

        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },

        data: JSON.stringify(payload),
      };
      axios
        .request(config)
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
        .catch(error => {
          setCalculateLoading(false);
        });
    }
  };

  const dataArray =
    calculatedPortfolioData?.length !== 0
      ? [
          ...Object.entries(calculatedPortfolioData?.buy).map(
            ([symbol, qty]) => ({
              symbol,
              qty,
              orderType: 'BUY',
              exchange: symbol.endsWith('-EQ') ? 'NSE' : 'BSE', // Set exchange based on suffix
            }),
          ),
          ...Object.entries(calculatedPortfolioData?.sell).map(
            ([symbol, qty]) => ({
              symbol,
              qty,
              orderType: 'SELL',
              exchange: symbol.endsWith('-EQ') ? 'NSE' : 'BSE', // Set exchange based on suffix
            }),
          ),
        ]
      : [];

  const totalInvestmentValue = dataArray
    .filter(item => item.orderType === 'BUY')
    .reduce((total, item) => {
      const currentPrice = 1;
      const investment = item.qty * currentPrice;
      return total + investment;
    }, 0);

  const stockDetails = convertResponse(dataArray, broker);

  const [planDetails, setPlanDetails] = useState(null);
  const getSpecificPlan = () => {
    if (specificPlan) {
      axios
        .get(
          `${server.server.baseUrl}api/admin/plan/detail/specific/${specificPlan._id}/${userEmail}`,
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
          if (res.data && res.data.data) {
            setStrategyDetails(res.data.data);
            setPlanDetails(res.data.data);
          } else {
            console.error('Unexpected API response:', res.data);
          }
        });
    }
  };

  useEffect(() => {
    if (specificPlan) {
      getSpecificPlan();
    } else {
      console.warn('specificPlan is undefined or null');
    }
  }, [specificPlan]);

  // console.log('Specific Plan1-', specificPlan);
  // console.log('Specific Plan2-', specificPlanDetails);
  // console.log('Specific Plan3-', singleStrategyDetails);

  const onClose = () => {
    setOpenSubscribeModel(false);
  };

  const onshow = () => {
    setOpenSubscribeModel(false);
  };

  ///
  const [isExpanded, setIsExpanded] = useState(false);

  const [globalConsent, setGlobalConsent] = useState(false);
  const [isConsentPopupOpen, setIsConsentPopupOpen] = useState(false); // initially open

  const handleConsentAccept = () => {
    setGlobalConsent(true);
    setIsConsentPopupOpen(false);
    // TODO: load the chart or perform any action after consent
    console.log('User accepted consent');
  };

  const handleConsentOpen = () => {
    setIsConsentPopupOpen(true);
    // TODO: load the chart or perform any action after consent
    console.log('User accepted consent');
  };

  // Helper function to calculate months label
  const calculateMonths = duration => duration;

  // Get available pricing options
  const getPricingOptions = () => {
    if (!specificPlan) return [];

    // If there is a single amount (legacy)
    if (specificPlan?.amount) {
      return [
        {
          label: `${calculateMonths(specificPlan.duration)} months`,
          value: specificPlan.amount,
          period: 'onetime',
        },
      ];
    }

    const options = [];

    // Handle onetime options
    if (
      specificPlan?.planType === 'onetime' &&
      Array.isArray(specificPlan.onetimeOptions)
    ) {
      specificPlan.onetimeOptions.forEach((opt, idx) => {
        if (opt.amountWithoutGst > 0) {
          options.push({
            period: `onetime-${idx}`,
            label: opt.label || `${opt.duration} days`,
            value: opt.amountWithoutGst,
          });
        }
      });
    }

    const isValidPrice = price => {
      if (price === undefined || price === null) return false;
      const normalizedPrice = Number(price);
      return !isNaN(normalizedPrice) && normalizedPrice > 0;
    };

    // Recurring options
    if (isValidPrice(specificPlan?.pricingWithoutGst?.monthly)) {
      options.push({
        period: 'monthly',
        label: 'Monthly',
        value: specificPlan.pricingWithoutGst.monthly,
      });
    }
    if (isValidPrice(specificPlan?.pricingWithoutGst?.quarterly)) {
      options.push({
        period: 'quarterly',
        label: 'Quarterly',
        value: specificPlan.pricingWithoutGst.quarterly,
      });
    }
    if (isValidPrice(specificPlan?.pricingWithoutGst?.['half-yearly'])) {
      options.push({
        period: 'half-yearly',
        label: '6 Months',
        value: specificPlan.pricingWithoutGst['half-yearly'],
      });
    }
    if (isValidPrice(specificPlan?.pricing?.yearly)) {
      options.push({
        period: 'yearly',
        label: 'Yearly',
        value: specificPlan.pricing.yearly,
      });
    }

    return options;
  };

  const pricingOptions = getPricingOptions();

  // Set selected pricing
  const [selectedPricing, setSelectedPricing] = useState(
    pricingOptions.length > 0 ? pricingOptions[0].period : null,
  );

  // Update selectedPricing if pricingOptions change dynamically
  useEffect(() => {
    if (
      pricingOptions.length > 0 &&
      !pricingOptions.find(opt => opt.period === selectedPricing)
    ) {
      setSelectedPricing(pricingOptions[0].period);
    }
  }, [pricingOptions]);

  // Current price calculation
  const getCurrentPrice = () => {
    if (!specificPlan) return 0;

    // Handle onetime plans
    if (
      specificPlan?.planType === 'onetime' &&
      specificPlan?.onetimeOptions?.length > 0
    ) {
      const selectedOption = pricingOptions.find(
        opt => opt.period === selectedPricing,
      );
      return Number(
        selectedOption?.value ??
          specificPlan.onetimeOptions[0].amountWithoutGst ??
          0,
      );
    }

    // Handle legacy amount
    if (specificPlan?.amount) {
      return Number(specificPlan.amount);
    }

    // Handle recurring plans
    const selectedOption = pricingOptions.find(
      opt => opt.period === selectedPricing,
    );
    return Number(selectedOption?.value ?? 0);
  };

  const currentPrice = getCurrentPrice();

  const getOriginalPrice = () => {
    if (!currentPrice || !specificPlan?.discountPercentage)
      return currentPrice || 0;
    const discountRate = specificPlan.discountPercentage / 100;
    return Math.round(currentPrice / (1 - discountRate));
  };

  const originalPrice = getOriginalPrice();
  const discount = specificPlan?.discountPercentage || 0;

  const image = null;

  const [subscriptionData, setSubscriptionData] = useState([]);
  const getAllSubscriptionData = () => {
    let config = {
      method: 'get',
      url: `${server.server.baseUrl}api/all-clients/user/${userEmail}`,
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
        setSubscriptionData(response.data.data);
      })
      .catch(error => {
        console.log(error);
      });
  };
  useEffect(() => {
    getAllSubscriptionData();
  }, []);

  const ACCEPTABLE_DATE_FORMATS = [
    'D MMM YYYY, HH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss.SSSZ',
  ];

  const getSubscriptionStatus = (planName, subscriptions) => {
    const normalizeGroupName = name => {
      if (!name) return '';
      return name.toLowerCase().replace(/%20/g, ' ').replace(/\s+/g, '_').trim();
    };

    if (!subscriptions || subscriptions.length === 0) return 'none';

    const matchingPlanSubs = subscriptions.filter(
      sub => {
        const nSub = normalizeGroupName(sub?.plan);
        const nPlan = normalizeGroupName(planName);
        return nSub === nPlan || nSub.includes(nPlan) || nPlan.includes(nSub);
      },
    );
    if (matchingPlanSubs.length === 0) return 'none';

    const activeSubscriptions = matchingPlanSubs.filter(
      sub => sub?.status !== 'deleted',
    );
    if (activeSubscriptions.length === 0) return 'none';

    const neverExpiringSubscriptions = activeSubscriptions.filter(
      sub => sub.expiry === null,
    );
    if (neverExpiringSubscriptions.length > 0) return 'active';

    const validSubscriptions = activeSubscriptions.filter(sub =>
      sub.expiry
        ? moment(sub.expiry, ACCEPTABLE_DATE_FORMATS, true).isValid()
        : false,
    );
    if (validSubscriptions.length === 0) return 'none';

    const latestSub = validSubscriptions.sort(
      (a, b) =>
        moment(b.expiry, ACCEPTABLE_DATE_FORMATS) -
        moment(a.expiry, ACCEPTABLE_DATE_FORMATS),
    )[0];

    const expiryDate = moment(latestSub?.expiry, ACCEPTABLE_DATE_FORMATS);
    const today = moment();
    const daysLeft = expiryDate.diff(today, 'days');

    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 7) return 'renew';
    return 'active';
  };
  const subscriptionStatus = getSubscriptionStatus(
    modelName,
    subscriptionData?.subscriptions,
  );
  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'renew';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{lex: 1}}>
        <View style={{flexDirection: 'column'}}>
          <View>
            <View>
              <View style={styles.container}>
                <TouchableOpacity activeOpacity={1}>
                  <LinearGradient
                    colors={['#002651', '#0076fb']}
                    start={{x: 0, y: 1}}
                    end={{x: 1, y: 1}}
                    style={[styles.cardContainer]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignContent: 'center',
                        alignItems: 'center',
                        marginBottom: 20,
                      }}>
                      <TouchableOpacity style={styles.backButton}>
                        <ChevronLeft
                          size={24}
                          color="#000"
                          onPress={() => navigation.goBack()}
                        />
                      </TouchableOpacity>
                      <View style={styles.header}>
                        <Text style={styles.title}>Bespoke Plans</Text>
                      </View>
                    </View>
                    {/* Header */}
                    <View style={styles.headerSection}>
                      <View style={styles.logoContainer}>
                        <Image
                          source={
                            strategyDetails?.image
                              ? {
                                  uri: `${server.server.baseUrl}${strategyDetails?.image}`,
                                } // Use image from server if available
                              : Alpha100 // Fallback to local image if null
                          }
                          style={styles.icon}
                        />
                      </View>
                      <Text style={styles.portfolioTitle}>
                        {modelName || 'ZC Leaders Portfolio'}
                      </Text>
                    </View>

                    {/* Price Section */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 0,
                      }}>
                      <View style={styles.priceSection}>
                        <Text style={styles.currentPrice}>
                          ₹ {currentPrice ? (configGst && configGstWithText ? withGst(currentPrice)?.toFixed(2) : currentPrice?.toFixed(2)) : 0}{gstLabel(configGst, configGstWithText)}
                        </Text>
                        {discount > 0 && (
                          <Text style={styles.originalPrice}>
                            ₹ {originalPrice?.toFixed(2)}
                          </Text>
                        )}
                      </View>
                      {discount > 0 && (
                        <LinearGradient
                          colors={['#58a100', '#1f7d00']}
                          start={{x: 0, y: 0}}
                          end={{x: 1, y: 0}}
                          style={styles.saveTag}>
                          <Text style={styles.saveTagText}>
                            Save {discount}%
                          </Text>
                        </LinearGradient>
                      )}
                    </View>

                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                      {pricingOptions.map(option => {
                        const isSelected = option.period === selectedPricing;
                        return (
                          <TouchableOpacity
                            key={option.period}
                            onPress={() => setSelectedPricing(option.period)}
                            style={{
                              paddingVertical: 2,
                              paddingHorizontal: 14,
                              borderRadius: 999,
                              backgroundColor: isSelected
                                ? '#rgba(255, 255, 255, 0.3)'
                                : 'transparent',
                              borderWidth: isSelected ? 0 : 1,
                              borderColor: isSelected
                                ? 'transparent'
                                : 'rgba(255, 255, 255, 0.6)',
                              marginRight: 8,
                              marginBottom: 8,
                              shadowColor: isSelected ? '#000' : 'transparent',
                              shadowOffset: {width: 0, height: 2},
                              shadowOpacity: isSelected ? 0.2 : 0,
                              shadowRadius: isSelected ? 2 : 0,
                              elevation: isSelected ? 2 : 0,
                            }}>
                            <Text
                              style={{
                                color: isSelected ? '#fff' : '#fff',
                                fontSize: 10,
                                marginTop: 2,
                                fontFamily: 'Poppins-Medium',
                              }}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Stats */}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Expanded Section */}
              </View>
            </View>
          </View>
          <ConsentPopup
            isConsentPopupOpen={isConsentPopupOpen}
            setIsConsentPopupOpen={setIsConsentPopupOpen}
            handleConsentAccept={handleConsentAccept}
          />

          <View style={styles.tabViewContainer}>
            <TabView
              navigationState={{index, routes}}
              renderScene={SceneMap({
                keyfeatures: () => (
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                    }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: '#002651',
                        marginBottom: 12,
                      }}>
                      Key Features
                    </Text>

                    {strategyDetails?.keyFeature?.length > 0 ? (
                      strategyDetails.keyFeature.map((feature, idx) => (
                        <View
                          key={idx}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: '#000',
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            shadowOffset: {width: 0, height: 2},
                            elevation: 2,
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                          }}>
                          <View
                            style={{
                              backgroundColor: '#E8F0FF',
                              borderRadius: 50,
                              padding: 8,
                              marginRight: 10,
                            }}>
                            <Star size={18} color="#0076FB" />
                          </View>

                          <View style={{flex: 1}}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: '#002651',
                                marginBottom: 4,
                              }}>
                              {feature.label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: '#475569',
                                lineHeight: 20,
                              }}>
                              {feature.description}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text
                        style={{
                          textAlign: 'center',
                          color: '#94A3B8',
                          marginTop: 8,
                          fontSize: 14,
                        }}>
                        No key features available.
                      </Text>
                    )}

                    {/* --- Divider --- */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: '#E5E7EB',
                        marginVertical: 20,
                      }}
                    />

                    {/* --- Key Benefits Section --- */}
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: '#002651',
                        marginBottom: 12,
                      }}>
                      Key Benefits
                    </Text>

                    {strategyDetails?.keyBenefit ? (
                      strategyDetails.keyBenefit
                        .split('\n')
                        .filter(line => line.trim() !== '')
                        .map((benefit, index) => (
                          <View
                            key={index}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              marginBottom: 10,
                              backgroundColor: '#F8FAFC',
                              padding: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                            }}>
                            <CheckCircle
                              size={18}
                              color="#0076FB"
                              style={{marginRight: 10, marginTop: 2}}
                            />
                            <Text
                              style={{
                                fontSize: 14,
                                color: '#334155',
                                flex: 1,
                                lineHeight: 20,
                              }}>
                              {benefit}
                            </Text>
                          </View>
                        ))
                    ) : (
                      <Text
                        style={{
                          textAlign: 'center',
                          color: '#94A3B8',
                          marginTop: 8,
                          fontSize: 14,
                        }}>
                        No key benefits available.
                      </Text>
                    )}
                  </ScrollView>
                ),

                overview: () => (
                  <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{
                        alignItems: 'flex-start',
                        paddingHorizontal: 16,
                        paddingTop: 0,
                        paddingBottom: 0,
                      }}>
                      <View
                        style={{
                          backgroundColor: '#EEF4FF',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#C7D2FE',
                          padding: 20,
                          marginTop: 20,
                        }}>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: '600',
                            color: '#1E293B',
                            marginBottom: 8,
                          }}>
                          Subscribe & Get Expert Research Guidance
                        </Text>

                        <Text
                          style={{
                            fontSize: 14,
                            color: '#475569',
                            marginBottom: 16,
                            lineHeight: 20,
                          }}>
                          Start by subscribing to our{' '}
                          <Text style={{fontWeight: '600', color: '#1F54DB'}}>
                            Research Investment Plan
                          </Text>
                          . Once subscribed, you'll receive personalized{' '}
                          <Text style={{fontWeight: '600'}}>
                            buy/sell recommendations
                          </Text>{' '}
                          directly from our certified RA/RIA professionals —
                          tailored to your goals and market opportunities. Our
                          experts will work with you to build and refine a
                          portfolio that aligns perfectly with your financial
                          objectives and risk profile.
                        </Text>
                      </View>
                    </ScrollView>
                  </SafeAreaView>
                ),
              })}
              onIndexChange={setIndex}
              initialLayout={{width: screenWidth}}
              onLayout={handleTabLayout(2)}
              renderTabBar={props => (
                <CustomTabBarMPPerformance
                  isSubscriptionActive={false}
                  {...props}
                />
              )}
            />
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          alignContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
          elevation: 20,
          shadowColor: 'grey',
        }}>
        {subscribed === true ? (
          <TouchableOpacity
            disabled={subscribed}
            style={styles.investButtondisable}>
            <Text style={styles.investButtonTextdisable}>Subscribed</Text>
          </TouchableOpacity>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
            }}>
            <TouchableOpacity
              onPress={handleInvestNow}
              style={styles.investButton}>
              <Text style={styles.investButtonText}>
                {subscriptionStatus === 'active'
                  ? 'Subscribed'
                  : subscriptionStatus === 'renew'
                  ? 'Renew now'
                  : subscriptionStatus === 'expired'
                  ? 'Resubscribe'
                  : 'Invest now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {paymentModal &&
        (console.log('Under', latestRebalance),
        (
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
            getStrategyDetails={() => getSingleStrategyDetails(modelName)}
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

            //setOpenTokenExpireModel={setOpenTokenExpireModel}
          />
        ))}

      {paymentSuccess === true ? (
        <PaymentSuccessModal
          specificPlan={specificPlan}
          specificPlanDetails={specificPlan}
          setPaymentSuccess={setPaymentSuccess}
          setPaymentModal={setPaymentModal}
          setSelectedCard={setSelectedCard}
          setOpenSubscribeModel={setOpenSubscribeModel}
        />
      ) : null}

      {openStrategy && (
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
          setOpenSubscribeModel={setOpenSubscribeModel}
          setOpenSucessModal={setOpenSucessModal}
          openSuccessModal={openSuccessModal}
          calculatedLoading={calculatedLoading}
          calculatedPortfolioData={calculatedPortfolioData}
          calculateRebalance={calculateRebalance}
        />
      )}

      {openSuccessModal && (
        <RecommendationSuccessModal
          openSuccessModal={openSuccessModal}
          setOpenSucessModal={setOpenSucessModal}
          orderPlacementResponse={orderPlacementResponse}
        />
      )}
      {console.log('OPennnser', OpenSubscribeModel, latestRebalance)}
      {OpenSubscribeModel === true && latestRebalance !== null ? (
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
      ) : null}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#002651',
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginVertical: 20,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 20,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  noDataImage: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 18,
    marginTop: 40,
    fontFamily: 'Satoshi-Bold',
    color: '#000000',
  },
  noDataSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Satoshi-Medium',
    textAlign: 'center',
    marginVertical: 8,
  },
  rebalanceContainer: {
    borderColor: '#F1F1F1',
    borderWidth: 1,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F8F8F8',
    paddingVertical: 20,
    borderRadius: 8,
    flexDirection: 'row',
    marginVertical: 20,
  },
  tabViewContainer: {
    flex: 1,
    height: ScreenHeight,
    width: screenWidth,
    paddingHorizontal: 0,
    // Make TabView container flexible
    marginTop: 10, // Added margin for spacing
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  icon: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: 'white',
    textAlignVertical: 'center',
    // Ensure the title doesn't exceed screen width
  },
  methodTextHead: {
    color: 'rgba(0, 0, 0, 0.85)',
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    marginTop: 20,
  },
  methodText: {color: 'rgba(0, 0, 0, 1)', fontSize: 11},
  subtitle: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Satoshi-Regular',
    opacity: 0.7,
    paddingHorizontal: 20,
    textAlign: 'left',
  },
  performanceContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginVertical: 10,
  },
  statBox1: {
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#cbcacb',
    paddingVertical: 5,
  },
  equityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    borderLeftWidth: 5,
    paddingVertical: 10,
  },
  statBox2: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#cbcacb',
  },
  statTitle: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#000',
    opacity: 0.6,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Satoshi-Black',
    color: '#16A085',
    textAlign: 'left',
    marginTop: 5,
  },
  mininvest: {
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
    color: '#000',
    textAlign: 'left',
    marginTop: 5,
  },
  detailsContainer: {
    marginHorizontal: 15,
    marginVertical: 5,
  },
  detailText: {
    flexDirection: 'row',
    fontSize: 14,
    color: '#000',
    borderBottomWidth: 0.5,
    paddingBottom: 5,
    opacity: 0.6,
    marginVertical: 5,
  },
  detailLabel: {
    fontFamily: 'Satoshi-Medium',
    color: 'black',
    marginLeft: 10,
  },
  detailLabel1: {
    fontFamily: 'Satoshi-Regular',
    color: 'black',
    marginLeft: 5,
  },
  scoreIcon: {
    width: 20,
    height: 20,
    marginLeft: 5,
  },
  investButton: {
    backgroundColor: '#0056B7',
    margin: 10,
    borderRadius: 5,
    flex: 1,
    // Slightly reduce width to give margin
    height: 45,
    justifyContent: 'center', // Centers content vertically
    alignSelf: 'center', // Centers the button itself horizontally
  },
  investButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    textAlign: 'center', // Centers text horizontally
  },
  investButtondisable: {
    backgroundColor: '#000',
    margin: 10,
    borderRadius: 5,
    width: screenWidth * 0.9, // Slightly reduce width to give margin
    height: 50,
    justifyContent: 'center', // Centers content vertically
    alignSelf: 'center', // Centers the button itself horizontally
  },
  investButtonTextdisable: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    textAlign: 'center', // Centers text horizontally
  },
  rebalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20, // Horizontal padding for the row
    marginBottom: 20, // Spacing between the rows
  },
  rebalanceDetails: {
    paddingVertical: 10,
    flex: 1,
    borderRadius: 3,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'flex-start', // Align text to the left
  },
  rebalanceLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',

    color: '#FFFFFF', // Light gray color for label text
    // Small space between label and date
  },
  rebalanceDate: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Poppins-Regular',
  },
  rebalanceSingleRow: {
    paddingHorizontal: 20, // Align with the previous row's padding
  },
  rebalanceFrequency: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Poppins-Regular',
  },

  //////  container: { marginHorizontal: 8, marginVertical: 8, },
  cardContainer: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    width: screenWidth,
    maxWidth: screenWidth,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  saveTag: {
    position: 'absolute',
    right: -20,
    top: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  saveTagText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'Poppins-SemiBold',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  headerSection: {flexDirection: 'row', alignItems: 'center', marginBottom: 5},
  logoContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: 0,
    marginRight: 12,
  },
  logo: {width: 32, height: 32, borderRadius: 8},
  portfolioTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    flex: 1,
  },
  priceSection: {flexDirection: 'row', alignItems: 'baseline', gap: 8},
  currentPrice: {color: '#fff', fontSize: 14, fontFamily: 'Poppins-Bold'},
  originalPrice: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textDecorationLine: 'line-through',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    padding: 8,
    marginBottom: 20,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  statItem: {flex: 1, justifyContent: 'space-between'},
  statIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignContent: 'center',
    alignSelf: 'center',
    marginLeft: 0,
  },
  statIcon: {
    color: '#000000ff',
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    marginTop: 2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    marginBottom: 4,
    marginRight: 10,
  },
  statValue: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  volatilityValue: {
    color: '#22c55e',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    alignSelf: 'flex-start',
  },
  cagrValue: {
    color: '#60a5fa',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },
  actionContainer: {flexDirection: 'row', gap: 12},
  viewMoreButton: {
    flex: 1,
    backgroundColor: 'rgba(232, 232, 232, 0.58)',
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreText: {color: '#fff', fontSize: 12, fontFamily: 'Poppins-Medium'},
  subscribeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  animatedSection: {
    backgroundColor: '#ECF3FE',
    elevation: 4,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#F3F4F6',
  },
  expandedContent: {alignItems: 'flex-start', justifyContent: 'flex-start'},
  descriptionText: {
    color: '#2359DE',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  overviewLabel: {
    color: '#2359DE',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
  },
  volatilityText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    textAlign: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  blurText: {
    opacity: 0.5, // simple blur effect
  },
  textGray: {
    color: '#9CA3AF', // gray-400
  },
  textRed: {
    color: '#DC2626', // red-600
  },
  textYellow: {
    color: '#F59E0B', // yellow-500
  },
  textGreen: {
    color: '#16A34A', // green-600
  },
});

export default BespokePerformanceScreen;
