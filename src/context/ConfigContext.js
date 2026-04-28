
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../utils/safeConfig';
import APP_VARIANTS from '../utils/Config';
import { generateToken } from '../utils/SecurityTokenManager';

const ConfigContext = createContext();

export const useConfig = () => {
    return useContext(ConfigContext);
};

export const ConfigProvider = ({ children }) => {
    const selectedVariant = Config?.APP_VARIANT || 'rgxresearch'; // Default to "rgxresearch" if not set
    // Ensure the variant exists in APP_VARIANTS, otherwise use 'rgxresearch'
    const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
    const initialConfig = { ...APP_VARIANTS[validVariant], selectedVariant: validVariant };
    const [config, setConfig] = useState(initialConfig);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Get base URL and subdomain from environment variables
                const baseUrl = Config.REACT_APP_NODE_SERVER_API_URL || 'http://localhost:8001/';
                const subdomain = Config.REACT_APP_ADVISOR_SUBDOMAIN || Config.REACT_APP_HEADER_NAME || 'rgxresearch';

                // Construct the API URL
                const apiUrl = `${baseUrl}api/app-advisor/get?appSubdomain=${subdomain}`;

                console.log('🔍 Fetching config from:', apiUrl);

                // Prepare headers with authentication
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': Config.REACT_APP_X_ADVISOR_SUBDOMAIN || Config.REACT_APP_HEADER_NAME || subdomain,
                    'aq-encrypted-key': Config.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                    ),
                };

                console.log('🔍 Request headers:', {
                    'X-Advisor-Subdomain': headers['X-Advisor-Subdomain'],
                    'aq-encrypted-key': headers['aq-encrypted-key'] ? 'SET' : 'MISSING',
                });

                const response = await axios.get(apiUrl, { headers });

                console.log('API Response:', response.data);

                if (response.data && response.data.data) {
                    const apiData = response.data.data; // API returns data nested under response.data.data

                    console.log('✅ API Data received from database:', {
                        appName: apiData.appName,
                        subdomain: apiData.subdomain,
                        themeColor: apiData.themeColor,
                        mainColor: apiData.mainColor,
                        gradient1: apiData.gradient1,
                        gradient2: apiData.gradient2,
                        secondaryColor: apiData.secondaryColor,
                        hasApiKeys: !!apiData.apiKeys,
                        advisorSpecificTag: apiData.apiKeys?.advisorSpecificTag,
                        advisorRaCode: apiData.apiKeys?.advisorRaCode,
                        brokerConnectRedirectUrl: apiData.brokerConnectRedirectUrl,
                        customDomain: apiData.customDomain,
                    });
                    console.log('[ConfigContext] Redirect URL resolution:', {
                        fromAPI: apiData.brokerConnectRedirectUrl,
                        fromEnv: Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL,
                        final: apiData.brokerConnectRedirectUrl || Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL || '',
                    });

                    // Map API response to APP_VARIANTS structure
                    // Priority: API data first, then fallback to static APP_VARIANTS for UI-specific fields
                    const newConfig = {
                        // Start with static UI defaults (colors, gradients, layout settings)
                        ...initialConfig,

                        // Override with API data (this is the primary source)
                        selectedVariant: validVariant, // Add selectedVariant to the config

                        // ============================================================================
                        // BASIC INFO
                        // ============================================================================
                        appName: apiData.appName || initialConfig.appName,
                        subdomain: apiData.subdomain || initialConfig.subdomain,

                        // ============================================================================
                        // CONTACT INFO
                        // ============================================================================
                        email: apiData.email || apiData.contactEmail || initialConfig.email,
                        supportEmail: apiData.supportEmail || apiData.contactEmail || initialConfig.supportEmail,
                        contactEmail: apiData.contactEmail || initialConfig.contactEmail,
                        adminEmail: apiData.adminEmail || initialConfig.adminEmail,

                        // ============================================================================
                        // AUTHENTICATION
                        // ============================================================================
                        googleWebClientId: apiData.googleWebClientId || initialConfig.googleWebClientId,

                        // ============================================================================
                        // DIGIO CONFIGURATION
                        // Backend stores in nested digioConfig object, so we extract from there
                        // digioCheck: 'beforePayment' or 'afterPayment'
                        // ============================================================================
                        digioCheck: apiData.digioConfig?.digioCheck || apiData.digioCheck || apiData.REACT_APP_DIGIO_CHECK || Config.REACT_APP_DIGIO_CHECK || 'beforePayment',
                        digioEnabled: apiData.digioConfig?.digioEnabled !== undefined
                            ? apiData.digioConfig.digioEnabled
                            : (apiData.digioEnabled !== undefined ? apiData.digioEnabled : true),
                        otpBasedAuthentication: apiData.digioConfig?.otpBasedAuthentication || apiData.otpBasedAuthentication || apiData.REACT_APP_OTP_BASED_AUTHENTICATION || false,
                        aadhaarBasedAuthentication: apiData.digioConfig?.aadhaarBasedAuthentication !== undefined
                            ? apiData.digioConfig.aadhaarBasedAuthentication
                            : true,

                        // ============================================================================
                        // FEATURE FLAGS
                        // Backend stores in nested featureFlags object
                        // ============================================================================
                        modelPortfolioEnabled: apiData.featureFlags?.modelPortfolioEnabled !== undefined
                            ? apiData.featureFlags.modelPortfolioEnabled
                            : (apiData.modelPortfolioEnabled !== undefined ? apiData.modelPortfolioEnabled : true),
                        bespokePlansEnabled: apiData.featureFlags?.bespokePlansEnabled !== undefined
                            ? apiData.featureFlags.bespokePlansEnabled
                            : (apiData.bespokePlansEnabled !== undefined ? apiData.bespokePlansEnabled : true),
                        brokerConnectEnabled: apiData.featureFlags?.brokerConnectEnabled !== undefined
                            ? apiData.featureFlags.brokerConnectEnabled
                            : true,
                        // When true, the client-side 09:15–15:30 IST gate is bypassed so
                        // advisors can queue orders after hours (broker decides accept/AMO).
                        // Default true — gate is bypassed unless an admin explicitly sets
                        // this flag to false on the advisor config record.
                        allowAfterHoursOrders: apiData.featureFlags?.allowAfterHoursOrders !== undefined
                            ? apiData.featureFlags.allowAfterHoursOrders
                            : (apiData.allowAfterHoursOrders !== undefined ? apiData.allowAfterHoursOrders : true),

                        // ============================================================================
                        // PAYMENT CONFIGURATION
                        // Supported platforms: 'razorpay', 'cashfree', 'payu'
                        // ============================================================================
                        paymentPlatform: apiData.paymentPlatform || 'cashfree',
                        razorpayKey: apiData.razorpayKey || '',
                        cashfreeAppId: apiData.cashfreeAppId || '',
                        payuMerchantKey: apiData.payuMerchantKey || '',

                        // ============================================================================
                        // BRANDING & THEME COLORS
                        // ============================================================================
                        themeColor: apiData.themeColor || initialConfig.themeColor,
                        logo: apiData.logo || initialConfig.logo,
                        toolbarlogo: apiData.toolbarlogo || initialConfig.toolbarlogo,
                        backgroundLogo: apiData.backgroundLogo || null,
                        showBackgroundLogo: apiData.showBackgroundLogo !== undefined ? apiData.showBackgroundLogo : true,
                        mainColor: apiData.mainColor || initialConfig.mainColor,
                        secondaryColor: apiData.secondaryColor || initialConfig.secondaryColor,
                        gradient1: apiData.gradient1 || initialConfig.gradient1,
                        gradient2: apiData.gradient2 || initialConfig.gradient2,
                        placeholderText: apiData.placeholderText || initialConfig.placeholderText,

                        // ============================================================================
                        // LAYOUT CONFIGURATION
                        // ============================================================================
                        homeScreenLayout: apiData.homeScreenLayout || initialConfig.homeScreenLayout,

                        // ============================================================================
                        // CARD STYLING
                        // Note: API uses camelCase (cardBorderWidth), static config uses CardborderWidth
                        // ============================================================================
                        CardborderWidth: apiData.cardBorderWidth ?? apiData.CardborderWidth ?? initialConfig.CardborderWidth,
                        cardElevation: apiData.cardElevation ?? initialConfig.cardElevation,
                        cardverticalmargin: apiData.cardVerticalMargin ?? apiData.cardverticalmargin ?? initialConfig.cardverticalmargin,

                        // ============================================================================
                        // BOTTOM TAB / NAVIGATION STYLING
                        // Note: API uses camelCase, static config uses mixed case
                        // ============================================================================
                        tabIconColor: apiData.tabIconColor || initialConfig.tabIconColor,
                        bottomTabBorderTopWidth: apiData.bottomTabBorderTopWidth ?? initialConfig.bottomTabBorderTopWidth,
                        bottomTabbg: apiData.bottomTabBg || apiData.bottomTabbg || initialConfig.bottomTabbg,
                        selectedTabcolor: apiData.selectedTabColor || apiData.selectedTabcolor || initialConfig.selectedTabcolor,

                        // ============================================================================
                        // BASKET COLORS (for stock basket cards)
                        // Note: API uses camelCase, static config uses lowercase
                        // ============================================================================
                        basket1: apiData.basket1 || initialConfig.basket1,
                        basket2: apiData.basket2 || initialConfig.basket2,
                        basketcolor: apiData.basketColor || apiData.basketcolor || initialConfig.basketcolor,
                        basketsymbolbg: apiData.basketSymbolBg || apiData.basketsymbolbg || initialConfig.basketsymbolbg,

                        // ============================================================================
                        // API KEYS (nested object) - API data takes priority
                        // ============================================================================
                        apiKeys: {
                            ...(initialConfig.apiKeys || {}),
                            ...(apiData.apiKeys || {}),
                        },

                        // ============================================================================
                        // BROKER API KEYS - Legacy format for backward compatibility
                        // These are exposed at config root level for components that use
                        // configData.config.REACT_APP_* format
                        // ============================================================================
                        REACT_APP_ANGEL_ONE_API_KEY: apiData.apiKeys?.angelOneApiKey || Config.REACT_APP_ANGEL_ONE_API_KEY || '',
                        REACT_APP_ZERODHA_API_KEY: apiData.apiKeys?.zerodhaApiKey || Config.REACT_APP_ZERODHA_API_KEY || '',
                        REACT_APP_BROKER_CONNECT_REDIRECT_URL: apiData.brokerConnectRedirectUrl || Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL || '',

                        // ============================================================================
                        // PAYMENT MODAL UI CUSTOMIZATION
                        // ============================================================================
                        paymentModal: {
                            ...(initialConfig.paymentModal || {}),
                            ...(apiData.paymentModal || {}),
                        },

                        // ============================================================================
                        // EMPTY STATE UI COLORS
                        // ============================================================================
                        EmptyStateUi: {
                            ...(APP_VARIANTS.EmptyStateUi || {}),
                            ...(apiData.EmptyStateUi || apiData.emptyStateUi || {}),
                        },

                        // ============================================================================
                        // SEMANTIC COLOR TOKENS (optional advisor override)
                        // Nested object — partial overrides of the default semantic palette
                        // defined in src/theme/colors.js. See docs/COLOR_TOKENS.md for the
                        // full token catalog.
                        // ============================================================================
                        colorTokens: apiData.colorTokens || {},
                    };

                    console.log('✅ Using newConfig from API for APP_VARIANTS:', {
                        // Basic Info
                        appName: newConfig.appName,
                        subdomain: newConfig.subdomain,
                        // Theme & Branding
                        themeColor: newConfig.themeColor,
                        mainColor: newConfig.mainColor,
                        homeScreenLayout: newConfig.homeScreenLayout,
                        // Authentication
                        googleWebClientId: newConfig.googleWebClientId,
                        // Digio Config
                        digioCheck: newConfig.digioCheck,
                        digioEnabled: newConfig.digioEnabled,
                        // Feature Flags
                        modelPortfolioEnabled: newConfig.modelPortfolioEnabled,
                        bespokePlansEnabled: newConfig.bespokePlansEnabled,
                        // API Keys
                        advisorSpecificTag: newConfig.apiKeys?.advisorSpecificTag,
                        advisorRaCode: newConfig.apiKeys?.advisorRaCode,
                    });

                    setConfig(newConfig);

                    // Sync fresh config to AsyncStorage so TradeContext also gets updated values
                    try {
                        const storedJson = await AsyncStorage.getItem('@app:advisorConfig');
                        if (storedJson) {
                            const stored = JSON.parse(storedJson);
                            const updatedStored = {
                                ...stored,
                                config: {
                                    ...(stored.config || {}),
                                    REACT_APP_BROKER_CONNECT_REDIRECT_URL: newConfig.REACT_APP_BROKER_CONNECT_REDIRECT_URL,
                                    REACT_APP_ANGEL_ONE_API_KEY: newConfig.REACT_APP_ANGEL_ONE_API_KEY,
                                    REACT_APP_ZERODHA_API_KEY: newConfig.REACT_APP_ZERODHA_API_KEY,
                                },
                            };
                            await AsyncStorage.setItem('@app:advisorConfig', JSON.stringify(updatedStored));
                            console.log('[ConfigContext] Synced fresh config to AsyncStorage');
                        }
                    } catch (syncErr) {
                        console.warn('[ConfigContext] Failed to sync to AsyncStorage:', syncErr.message);
                    }
                }
            } catch (error) {
                console.error('❌ Error fetching app config:', error);
                console.error('❌ Error details:', {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    responseData: error.response?.data,
                });
                // Fallback to default config is already set in initial state
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []); // Empty dependency array - run only once on mount

    return (
        <ConfigContext.Provider value={{ ...config, configLoading: loading }}>
            {children}
        </ConfigContext.Provider>
    );
};
