/**
 * BespokePerformanceScreen — container (Phase G batch 2, 2026-05-02)
 *
 * Owns ALL data fetching and business logic: user details, strategy details,
 * single strategy, all strategies, specific plan, subscription data, funds,
 * rebalance calculation, pricing options, subscription status.
 * Renders presentation resolved from `screens.BespokePerformanceScreen`.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-native';
import { Dimensions } from 'react-native';
import axios from 'axios';
import moment from 'moment';
import CryptoJS from 'react-native-crypto-js';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import Config from 'react-native-config';
import IsMarketHours from '../../utils/isMarketHours';
import { fetchFunds } from '../../FunctionCall/fetchFunds';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import { convertResponse } from '../../utils/tradeUtils';
import { useGstConfig } from '../../context/GstConfigContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useComponent } from '../../design/useDesign';
import { getSubscriptionStatusString } from '../../utils/subscriptionStatus';

const screenWidth = Dimensions.get('window').width;
const ScreenHeight = Dimensions.get('window').height;

const colorPalette = [
    '#EAE7DC', '#F5F3F4', '#D4ECDD', '#FFDDC1', '#F8E9A1',
    '#B2C9AB', '#FFC8A2', '#F6BD60', '#CB997E', '#A5A58D',
    '#B7CADB', '#E2F0CB', '#C1D37F', '#FFEBBB', '#D3C4C4',
    '#D4A5A5', '#FFF3E2', '#F7B7A3', '#EFD6AC', '#FAE3D9',
];

const BespokePerformanceScreen = ({ route }) => {
    const { modelName, specificPlan } = route.params;
    const { configData } = useTrade();
    const navigation = useNavigation();
    const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

    const auth = getAuth();
    const user = auth.currentUser;
    const { fileName } = useParams();
    const userEmail = user && user.email;

    // State
    const [confirmOrder, setConfirmOrder] = useState(false);
    const [userDetails, setUserDetails] = useState();
    const [strategyDetails, setStrategyDetails] = useState({ pieData: [] });
    const [latestRebalance, setLatestRebalance] = useState(null);
    const [funds, setFunds] = useState({});
    const [broker, setBroker] = useState('');
    const [index, setIndex] = useState(0);
    const [tabHeights, setTabHeights] = useState([0, 0, 0]);
    const [openSuccessModal, setOpenSucessModal] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [orderPlacementResponse, setOrderPlacementResponse] = useState();
    const [lastSubmittedTrades, setLastSubmittedTrades] = useState(null);
    const [paymentModal, setPaymentModal] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [oneTimeAmount, setOneTimeAmount] = useState(null);
    const [selectedPlanType, setSelectedPlanType] = useState(null);
    const [oneTimeDurationPlan, setOneTimeDurationPlan] = useState(null);
    const [showPaymentFail, setShowPaymentFail] = useState(false);
    const [namemodel, setnamemodel] = useState('');
    const [allStrategy, setAllStrategy] = useState([]);
    const [OpenSubscribeModel, setOpenSubscribeModel] = useState(false);
    const [openStrategy, setOpenStrategy] = useState(false);
    const [specificPlanDetails, setSpecificPlanDetails] = useState();
    const [singleStrategyDetails, setSingleStrategyDetails] = useState();
    const [isExpanded, setIsExpanded] = useState(false);
    const [globalConsent, setGlobalConsent] = useState(false);
    const [isConsentPopupOpen, setIsConsentPopupOpen] = useState(false);
    const [calculatedPortfolioData, setCaluculatedPortfolioData] = useState([]);
    const [calculatedLoading, setCalculateLoading] = useState(false);
    const [BrokerModel, setBrokerModel] = useState(false);
    const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);
    const [planDetails, setPlanDetails] = useState(null);
    const [subscriptionData, setSubscriptionData] = useState([]);

    const [routes] = useState([
        { key: 'keyfeatures', title: 'Key Features' },
        { key: 'overview', title: 'OverView' },
    ]);

    const [modalContext, setModalContext] = useState({
        specificPlan: null,
        specificPlanDetails: null,
        singleStrategyDetails: null,
        fileName: '',
    });

    const handleTabLayout = idx => event => {
        const { height } = event.nativeEvent.layout;
        setTabHeights(prev => {
            const newHeights = [...prev];
            newHeights[idx] = height;
            return newHeights;
        });
    };

    // Chart data
    const { chartData, chartConfig, colorMap } = useMemo(() => {
        const cMap = {};
        const data =
            latestRebalance?.adviceEntries?.map((entry, idx) => {
                const color = colorPalette[idx % colorPalette.length];
                cMap[entry.symbol] = color;
                return {
                    shares: entry.symbol,
                    value: entry.value * 100,
                    fill: color,
                };
            }) || [];

        const cfg = {
            value: { label: 'Equity Distribution' },
            ...data.reduce((acc, entry) => {
                acc[entry.shares] = { label: entry.shares, color: entry.fill };
                return acc;
            }, {}),
        };

        return { chartData: data, chartConfig: cfg, colorMap: cMap };
    }, [latestRebalance]);

    // API calls
    useEffect(() => {
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
        getUserDetails();
    }, [userEmail]);

    const getStrategyDetails = () => {
        if (namemodel !== null) {
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
                    const portfolioData = res?.data?.[0]?.originalData;
                    if (!portfolioData) return;
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

    useEffect(() => { setnamemodel(modelName); }, [modelName]);
    useEffect(() => { getStrategyDetails(); }, [namemodel]);

    const getSingleStrategyDetails = () => {
        if (namemodel !== null) {
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
                    const portfolioData = res?.data?.[0]?.originalData;
                    if (!portfolioData) return;
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
        let cfg = {
            method: 'get',
            url: `${server.server.baseUrl}api/admin/plan/${configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain()}/model portfolio/${userEmail}`,
            headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
        };
        axios
            .request(cfg)
            .then(response => { setAllStrategy(response.data.data); })
            .catch(error => {});
    };

    useEffect(() => { getAllStrategy(); }, []);

    const handleCardClickSelect = item => { setSelectedCard(item); };

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

    // The optional chain `planDetails?.subscribed_by?.filter(...)` is unsafe
    // when `subscribed_by` is a defined-but-non-array value (object or
    // string). The API has been observed returning non-array shapes. Guard
    // explicitly with `Array.isArray()` before calling array methods.
    const subscribed = Array.isArray(planDetails?.subscribed_by)
        && planDetails.subscribed_by.includes(userEmail);

    const clientCode = userDetails?.clientCode;
    const apiKey = userDetails?.apiKey;
    const jwtToken = userDetails?.jwtToken;
    const secretKey = userDetails?.secretKey;

    const checkValidApiAnSecret = data => {
        if (!data) return null;
        try {
            const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
            const Key = bytesKey.toString(CryptoJS.enc.Utf8);
            if (Key) return Key;
            throw new Error('Invalid Key');
        } catch (error) {
            return null;
        }
    };

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
                userEmail, userBroker: broker, modelName: strategyDetails?.model_name,
                advisor: strategyDetails?.advisor, model_id: latestRebalance?.model_Id,
                userFund: funds?.data?.availablecash,
            };
            if (broker === 'IIFL Securities') {
                payload = { ...payload, clientCode };
            } else if (broker === 'ICICI Direct') {
                payload = { ...payload, apiKey: checkValidApiAnSecret(apiKey), secretKey: checkValidApiAnSecret(secretKey), sessionToken: jwtToken };
            } else if (broker === 'Upstox') {
                payload = { ...payload, clientCode, apiKey: checkValidApiAnSecret(apiKey), apiSecret: checkValidApiAnSecret(secretKey), accessToken: jwtToken };
            } else if (broker === 'Angel One') {
                payload = { ...payload, apiKey: configData?.config?.REACT_APP_ANGEL_ONE_API_KEY, jwtToken };
            } else if (broker === 'Kotak') {
                payload = { ...payload, consumerKey: checkValidApiAnSecret(apiKey), accessToken: jwtToken };
            } else if (broker === 'Hdfc Securities') {
                payload = { ...payload, apiKey: checkValidApiAnSecret(apiKey), accessToken: jwtToken };
            }

            let cfg = {
                method: 'post',
                url: `${server.ccxtServer.baseUrl}rebalance/calculate`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                    'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                },
                data: JSON.stringify(payload),
            };
            axios
                .request(cfg)
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
                .catch(error => { setCalculateLoading(false); });
        }
    };

    const dataArray =
        calculatedPortfolioData?.length !== 0
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
                    } else {
                        console.error('Unexpected API response:', res.data);
                    }
                });
        }
    };

    useEffect(() => {
        if (specificPlan) { getSpecificPlan(); } else { console.warn('specificPlan is undefined or null'); }
    }, [specificPlan]);

    const handleConsentAccept = () => {
        setGlobalConsent(true);
        setIsConsentPopupOpen(false);
    };

    // Pricing
    const calculateMonths = duration => duration;
    const getPricingOptions = () => {
        if (!specificPlan) return [];
        if (specificPlan?.amount) {
            return [{ label: `${calculateMonths(specificPlan.duration)} months`, value: specificPlan.amount, period: 'onetime' }];
        }
        const options = [];
        if (specificPlan?.planType === 'onetime' && Array.isArray(specificPlan.onetimeOptions)) {
            specificPlan.onetimeOptions.forEach((opt, idx) => {
                if (opt.amountWithoutGst > 0) {
                    options.push({ period: `onetime-${idx}`, label: opt.label || `${opt.duration} days`, value: opt.amountWithoutGst });
                }
            });
        }
        const isValidPrice = price => { if (price === undefined || price === null) return false; const n = Number(price); return !isNaN(n) && n > 0; };
        if (isValidPrice(specificPlan?.pricingWithoutGst?.monthly)) options.push({ period: 'monthly', label: 'Monthly', value: specificPlan.pricingWithoutGst.monthly });
        if (isValidPrice(specificPlan?.pricingWithoutGst?.quarterly)) options.push({ period: 'quarterly', label: 'Quarterly', value: specificPlan.pricingWithoutGst.quarterly });
        if (isValidPrice(specificPlan?.pricingWithoutGst?.['half-yearly'])) options.push({ period: 'half-yearly', label: '6 Months', value: specificPlan.pricingWithoutGst['half-yearly'] });
        if (isValidPrice(specificPlan?.pricing?.yearly)) options.push({ period: 'yearly', label: 'Yearly', value: specificPlan.pricing.yearly });
        return options;
    };

    const pricingOptions = getPricingOptions();
    const [selectedPricing, setSelectedPricing] = useState(pricingOptions.length > 0 ? pricingOptions[0].period : null);

    useEffect(() => {
        if (pricingOptions.length > 0 && !pricingOptions.find(opt => opt.period === selectedPricing)) {
            setSelectedPricing(pricingOptions[0].period);
        }
    }, [pricingOptions]);

    const getCurrentPrice = () => {
        if (!specificPlan) return 0;
        if (specificPlan?.planType === 'onetime' && specificPlan?.onetimeOptions?.length > 0) {
            const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
            return Number(selectedOption?.value ?? specificPlan.onetimeOptions[0].amountWithoutGst ?? 0);
        }
        if (specificPlan?.amount) return Number(specificPlan.amount);
        const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
        return Number(selectedOption?.value ?? 0);
    };

    const currentPrice = getCurrentPrice();
    const getOriginalPrice = () => {
        if (!currentPrice || !specificPlan?.discountPercentage) return currentPrice || 0;
        const discountRate = specificPlan.discountPercentage / 100;
        return Math.round(currentPrice / (1 - discountRate));
    };
    const originalPrice = getOriginalPrice();
    const discount = specificPlan?.discountPercentage || 0;

    const getAllSubscriptionData = () => {
        let cfg = {
            method: 'get',
            url: `${server.server.baseUrl}api/all-clients/user/${userEmail}`,
            headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
        };
        axios.request(cfg).then(response => { setSubscriptionData(response.data.data); }).catch(error => { console.log(error); });
    };
    useEffect(() => { getAllSubscriptionData(); }, []);

    // Shared util — consults subscriptionData.groups before subscriptions
    // (web parity, prod-alphaquark-github/src/Home/PricingSection/IPOCard.js
    // hasActiveSubscription). Pass the FULL subscriptionData object so
    // the groups branch can fire; the previous inline copy only looked at
    // `.subscriptions` and produced false-positives for plans the user
    // never subscribed to (2026-06-09 MySubscriptionsScreen bug, same
    // shape here).
    const subscriptionStatus = getSubscriptionStatusString(modelName, subscriptionData);
    const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'renew';

    const Presentation = useComponent('screens.BespokePerformanceScreen');

    return (
        <Presentation
            viewModel={{
                modelName,
                strategyDetails,
                singleStrategyDetails,
                latestRebalance,
                planDetails,
                specificPlan,
                userEmail,
                broker,
                userDetails,
                funds,
                subscribed,
                subscriptionStatus,
                isActive,
                pricingOptions,
                selectedPricing,
                currentPrice,
                originalPrice,
                discount,
                index,
                routes,
                tabHeights,
                screenWidth,
                screenHeight: ScreenHeight,
                chartData,
                chartConfig,
                colorMap,
                confirmOrder,
                calculatedPortfolioData,
                calculatedLoading,
                dataArray,
                stockDetails,
                fileName,
                paymentModal,
                paymentSuccess,
                openStrategy,
                openSuccessModal,
                OpenSubscribeModel,
                orderPlacementResponse,
                lastSubmittedTrades,
                selectedCard,
                isConsentPopupOpen,
                showPaymentFail,
                clientCode,
                apiKey,
                secretKey,
                jwtToken,
                BrokerModel,
                OpenTokenExpireModel,
                selectedPlanType,
                oneTimeAmount,
                oneTimeDurationPlan,
                configGst,
                configGstWithText,
                serverBaseUrl: server.server.baseUrl,
            }}
            actions={{
                onGoBack: () => navigation.goBack(),
                onTabIndexChange: setIndex,
                onSelectedPricingChange: setSelectedPricing,
                onInvestNow: () => setPaymentModal(true),
                onCloseInvestNowModal: () => setPaymentModal(false),
                onCloseReviewTrade: () => setOpenStrategy(false),
                onConsentAccept: handleConsentAccept,
                onConsentOpen: () => setIsConsentPopupOpen(true),
                onSetConfirmOrder: setConfirmOrder,
                onSetPaymentSuccess: setPaymentSuccess,
                onSetPaymentModal: setPaymentModal,
                onSetSelectedCard: setSelectedCard,
                onSetOpenSubscribeModel: setOpenSubscribeModel,
                onSetOpenSucessModal: setOpenSucessModal,
                onSetOrderPlacementResponse: setOrderPlacementResponse,
                onSetLastSubmittedTrades: setLastSubmittedTrades,
                onSetOpenTokenExpireModel: setOpenTokenExpireModel,
                onSetBrokerModel: setBrokerModel,
                onSetSelectedPlanType: setSelectedPlanType,
                onSetOneTimeAmount: setOneTimeAmount,
                onSetOneTimeDurationPlan: setOneTimeDurationPlan,
                onSetIsConsentPopupOpen: setIsConsentPopupOpen,
                onSetShowPaymentFail: setShowPaymentFail,
                onCalculateRebalance: calculateRebalance,
                getStrategyDetails,
                getAllStrategy,
                getSingleStrategyDetails,
                onHandleTabLayout: handleTabLayout,
                onHandleCardClickSelect: handleCardClickSelect,
            }}
        />
    );
};

export default BespokePerformanceScreen;
