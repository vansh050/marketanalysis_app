
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

// Default variant used when APP_VARIANT is missing or unknown. Was
// 'rgxresearch' historically — but rgxresearch falls through to
// sharedUIConfig, whose logo / theme is ZamZam-branded (sharedUIConfig
// was originally the ZamZam variant config; logo file
// `src/assets/AppLogo/logo.png` is byte-identical to
// `src/assets/AppLogo/Zamzam.png`). On AlphaQuark builds we MUST NOT
// silently degrade to ZamZam branding when the env var fails to
// resolve (gradle missed the .env, react-native-config not linked,
// dev build bundling stale config, etc.). 'alphaquark' is a safer
// default for this codebase since the variant explicitly declares
// AlphaQuarkLogo. White-label tenants who deploy this app from their
// own fork should change DEFAULT_VARIANT to their own variant key.
const DEFAULT_VARIANT = 'alphaquark';

export const ConfigProvider = ({ children }) => {
    const selectedVariant = Config?.APP_VARIANT || DEFAULT_VARIANT;
    // Ensure the variant exists in APP_VARIANTS; otherwise fall back
    // to DEFAULT_VARIANT (alphaquark) — never to a variant whose
    // sharedUIConfig contains foreign branding.
    const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : DEFAULT_VARIANT;
    if (!Config?.APP_VARIANT) {
        // Loud warning so a missing env var is visible during dev /
        // staging builds rather than silently picking the default.
        // eslint-disable-next-line no-console
        console.warn(
            '[ConfigContext] APP_VARIANT not set in .env — defaulting to',
            DEFAULT_VARIANT,
            '. If this is a non-AlphaQuark tenant build, set APP_VARIANT explicitly.',
        );
    }
    const initialConfig = { ...APP_VARIANTS[validVariant], selectedVariant: validVariant };
    const [config, setConfig] = useState(initialConfig);
    const [loading, setLoading] = useState(true);

    // 2026-05-07: hydrate the theme/branding from AsyncStorage on
    // mount BEFORE the API fetch runs. This way if the API call fails
    // on a relaunch (intermittent network, server slow, DNS hiccup),
    // the UI still renders with the last-known-good production theme
    // from cache instead of falling back to the bare static
    // APP_VARIANTS defaults — those defaults are intentionally
    // generic (`gradient1/2: '#F0F0F0'`, `placeholderText: '#FFFFFF'`)
    // and produce a near-blank washed-out home screen for any
    // production tenant whose theme has been loaded before.
    //
    // The fresh API response in fetchConfig below still wins the
    // moment it lands; this only affects the first-paint window.
    useEffect(() => {
        const hydrateFromCache = async () => {
            try {
                const cachedJson = await AsyncStorage.getItem('@app:configThemeCache');
                if (!cachedJson) return;
                const cached = JSON.parse(cachedJson);
                // Only adopt cache for the SAME variant to avoid
                // showing tenant A's theme briefly to tenant B's
                // build (e.g. dev switching between APP_VARIANTs).
                if (cached?.selectedVariant && cached.selectedVariant !== validVariant) return;
                console.log('[ConfigContext] hydrated theme from AsyncStorage cache');
                setConfig(prev => ({ ...prev, ...cached }));
            } catch (e) {
                console.warn('[ConfigContext] hydrateFromCache error:', e?.message);
            }
        };
        hydrateFromCache();
    }, [validVariant]);

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

                // D3 (docs/WEB_PARITY_MIGRATION_2026-06.md §4.1): the RIA / NBA /
                // Portfolio-Health / Transition flags are NOT in /api/app-advisor/get —
                // they live in advisor_config and are served by /api/admin/frontend-config
                // (no admin auth; reads the advisor from the X-Advisor-Subdomain header,
                // which `headers` already carries). Kick it off BEFORE awaiting the main
                // config so the two fetches run in PARALLEL (no serial cold-start cost).
                // Never throws — a failure leaves every new flag at its default (false).
                const parityFlagsPromise = (async () => {
                    try {
                        // HARD timeout: this fetch must NEVER block the advisor
                        // branding/config from applying. If frontend-config is slow or
                        // hangs, bail fast and leave the parity flags at default-OFF —
                        // the main app-advisor/get config (theme, logo, gradients) still
                        // applies. (Without this, a stalled flags call would leave the UI
                        // on bare defaults: red #ff0000 accent + missing logo.)
                        const ff = await axios.get(`${baseUrl}api/admin/frontend-config`, {
                            headers,
                            timeout: 6000,
                        });
                        const d = ff?.data?.data || ff?.data || {};
                        return {
                            riaBillingEnabled:       d.riaBillingEnabled === true,
                            nbaHomeEnabled:          d.nbaHomeEnabled === true,
                            portfolioHealthEnabled:  d.portfolioHealthEnabled === true,
                            transitionEngineEnabled: d.transitionEngineEnabled === true,
                            portfolioHealth:         d.portfolioHealth || undefined,
                            // In-app support widget (chat + voice), customer side. Default OFF.
                            voiceSupportUserEnabled: d.voiceSupportUserEnabled === true,
                            // Client Performance Summary (fund-wise portfolio summary +
                            // value history + realised P&L). Default-ON, mirroring web's
                            // `!== false` gate in Routes/Admin/loginRoutes.js /frontend-config.
                            performanceSummaryEnabled: d.performanceSummaryEnabled !== false,
                            // Checkout-time blocking KYC gate (PAN+DoB → KRA verify
                            // BEFORE payment/Digio). Default OFF, mirrors web's
                            // `=== true` gate in loginRoutes.js /frontend-config.
                            kycBlockingEnabled:      d.kycBlockingEnabled === true,
                            // Phone-first login flow (Onboarding video carousel →
                            // PhoneLogin capture, BEFORE the standard email/Google
                            // Login screen). Default OFF, mirrors web's `=== true`
                            // gate in loginRoutes.js /frontend-config. Restores
                            // arfs_app's original pre-sync flow as a fleet-wide,
                            // per-advisor opt-in (2026-07-17).
                            phoneFirstLoginEnabled:  d.phoneFirstLoginEnabled === true,
                            // Angel One auth mode. DEFAULT TRUE (legacy shared-platform
                            // key OAuth). Only an explicit `false` on the advisor's admin
                            // doc switches to the per-customer SmartAPI credentials form
                            // (+ per-customer egress IP whitelist). Mirrors web's
                            // loginRoutes.js /frontend-config + AppConfigContext gate.
                            useSharedAngelOneKey:    d.useSharedAngelOneKey === false ? false : true,
                        };
                    } catch (e) {
                        console.warn('[ConfigContext] frontend-config flags unavailable, defaulting OFF:', e?.message);
                        return {};
                    }
                })();

                const response = await axios.get(apiUrl, { headers });
                const parityFlags = await parityFlagsPromise;

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
                        // Backend (apiData) wins over the static Config.js fallback for
                        // googleWebClientId. Defensive `.trim()` because the backend has been
                        // observed returning the value with trailing whitespace
                        // (`'713385591555-…googleusercontent.com '`), which Google Sign-In
                        // rejects with DEVELOPER_ERROR if passed verbatim.
                        // ============================================================================
                        googleWebClientId:
                            (typeof apiData.googleWebClientId === 'string'
                                ? apiData.googleWebClientId.trim()
                                : apiData.googleWebClientId) ||
                            initialConfig.googleWebClientId,

                        // iOS-only Google Sign-In client ID (per-tenant Firebase
                        // project). Same backend-over-variant precedence + defensive
                        // .trim() as googleWebClientId. Consumed by Login/LogOutScreen;
                        // only applied on iOS (undefined is a harmless no-op elsewhere).
                        googleIosClientId:
                            (typeof apiData.googleIosClientId === 'string'
                                ? apiData.googleIosClientId.trim()
                                : apiData.googleIosClientId) ||
                            initialConfig.googleIosClientId,

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

                        // Courses + Webinars per-advisor gates. Source of truth on
                        // the server is AdvisorConfig.{courses_enabled,webinars_enabled}
                        // surfaced as camelCase by /api/app-advisor/get's AdvisorConfig
                        // lookup block (mirrors web's AppConfigContext default-false).
                        // Drawer entries + webinar screens consume these.
                        coursesEnabled:  apiData.coursesEnabled  ?? false,
                        webinarsEnabled: apiData.webinarsEnabled ?? false,

                        // RIA AUM-billing / NBA / Portfolio-Health / Transition per-advisor
                        // gates (D3). Source of truth: advisor_config.{aum_billing.enabled,
                        // nba_home_enabled, portfolio_health_enabled, transition_engine_enabled,
                        // portfolio_health}, served by /api/admin/frontend-config (fetched in
                        // parallel above → `parityFlags`). Default OFF — nothing renders until
                        // an advisor opts in from supportAQ (AdvisorConfigPage). Toggles already
                        // exist there for nba/health/transition.
                        riaBillingEnabled:       parityFlags.riaBillingEnabled       ?? false,
                        nbaHomeEnabled:          parityFlags.nbaHomeEnabled          ?? false,
                        portfolioHealthEnabled:  parityFlags.portfolioHealthEnabled  ?? false,
                        transitionEngineEnabled: parityFlags.transitionEngineEnabled ?? false,
                        voiceSupportUserEnabled: parityFlags.voiceSupportUserEnabled ?? false,
                        portfolioHealth:         parityFlags.portfolioHealth         ?? undefined,
                        // Client Performance Summary — DEFAULT-ON to match web. A failed
                        // frontend-config fetch (parityFlags == {}) still enables it.
                        performanceSummaryEnabled: parityFlags.performanceSummaryEnabled ?? true,
                        // Checkout-time blocking KYC gate — DEFAULT-OFF. A failed
                        // frontend-config fetch (parityFlags == {}) leaves it OFF.
                        kycBlockingEnabled:      parityFlags.kycBlockingEnabled ?? false,
                        // Phone-first login flow — DEFAULT-OFF. A failed
                        // frontend-config fetch (parityFlags == {}) leaves it OFF,
                        // so SplashScreen's default (loading/off/error) always
                        // resolves to the standard Login screen.
                        phoneFirstLoginEnabled:  parityFlags.phoneFirstLoginEnabled ?? false,
                        // Angel One shared-vs-per-customer — DEFAULT TRUE (shared). A
                        // failed frontend-config fetch (parityFlags == {}) keeps the
                        // working legacy shared-key OAuth, never breaks connect.
                        useSharedAngelOneKey:    parityFlags.useSharedAngelOneKey ?? true,

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
                        // PER-TENANT CONFIG MIGRATED FROM .env → appadvisors (supportAQ-controlled)
                        // ----------------------------------------------------------------------------
                        // Each of these resolves `appadvisors value ?? .env fallback`, so a tenant's
                        // settings can be changed from supportAQ App Advisors with NO app rebuild.
                        // The .env value remains the bootstrap/offline fallback (and stays correct
                        // per build). These are also written into the AsyncStorage `@app:advisorConfig`
                        // sync block below, so every consumer reading
                        // `configData.config.REACT_APP_*` (TradeContext) gets the backend value too.
                        // What deliberately stays in .env: REACT_APP_HEADER_NAME (subdomain — used to
                        // fetch THIS config), REACT_APP_AQ_KEYS/SECRET (signs the fetch; secret),
                        // server base URLs, APP_VARIANT (design, read before config loads),
                        // REACT_APP_FIREBASE_* (native, bound to google-services.json), MARKET_WS_*.
                        // ============================================================================
                        REACT_APP_ADVISOR_SPECIFIC_TAG:
                            apiData.advisorSpecificTag || apiData.apiKeys?.advisorSpecificTag || Config.REACT_APP_ADVISOR_SPECIFIC_TAG || '',
                        REACT_APP_WHITE_LABEL_TEXT:
                            apiData.whiteLabelText || apiData.appName || Config.REACT_APP_WHITE_LABEL_TEXT || '',
                        REACT_APP_ADVISOR_SPECIFIER:
                            apiData.advisorSpecifier || apiData.apiKeys?.advisorSpecifier || Config.REACT_APP_ADVISOR_SPECIFIER || 'RA',
                        REACT_APP_RAZORPAY_LIVE_API_KEY:
                            apiData.apiKeys?.razorpayKeyId || apiData.razorpayKey || Config.REACT_APP_RAZORPAY_LIVE_API_KEY || '',
                        REACT_APP_DIGIO_CHECK:
                            apiData.digioConfig?.digioCheck || apiData.digioCheck || Config.REACT_APP_DIGIO_CHECK || 'beforePayment',
                        REACT_APP_ADVISOR_LOGO:
                            apiData.advisorLogo || Config.REACT_APP_ADVISOR_LOGO || '',
                        // Semantic (camelCase) aliases for components that prefer config.* over the
                        // legacy REACT_APP_* shape.
                        whiteLabelText:
                            apiData.whiteLabelText || apiData.appName || Config.REACT_APP_WHITE_LABEL_TEXT || initialConfig.appName,
                        advisorSpecifier:
                            apiData.advisorSpecifier || apiData.apiKeys?.advisorSpecifier || Config.REACT_APP_ADVISOR_SPECIFIER || 'RA',
                        advisorSpecificTag:
                            apiData.advisorSpecificTag || apiData.apiKeys?.advisorSpecificTag || Config.REACT_APP_ADVISOR_SPECIFIC_TAG || '',

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

                        // ============================================================================
                        // TENANT TAGLINES (optional advisor override)
                        // ============================================================================
                        // Hero copy + trust badges shown on auth screens. The alphanomy
                        // variant reads these to override its built-in tenant copy
                        // ("Folios · Research", "Your Alpha, Engineered.", "SEBI Registered",
                        // etc.) — see designs/alphanomy/screens/LoginScreen.js +
                        // SignupScreen.js. Falls back to the hardcoded variant copy when
                        // a field is missing.
                        //
                        // Backend shape (`appadvisors.taglines`):
                        //   {
                        //     login: {
                        //       brandSubtag,   // string — sub-tag under brand name
                        //       heroTitle,     // string — main hero heading (allows \n)
                        //       heroSubtitle,  // string — supporting copy
                        //       trustBadges,   // [{ icon: 'check'|'shield'|...,  label: string }]
                        //     },
                        //     signup: {
                        //       brandSubtag,
                        //       heroTitle,
                        //       heroSubtitle,    // careful with claims like "50,000+ investors"
                        //                        // — legal/compliance review per tenant
                        //     },
                        //     home: {
                        //       recommendationsSubtitle,    // string — under "Recommendations" section
                        //       modelPortfoliosSubtitle,    // string — under "Model Portfolios" section
                        //       bespokePlansSubtitle,       // string — under "Top Bespoke Plans" section
                        //     }
                        //   }
                        //
                        // Compliance note: any quantitative claim (investor counts, returns,
                        // performance numbers) must be tenant-approved before going live.
                        // Surfacing taglines via backend lets legal vary copy per tenant
                        // without a code change.
                        taglines: apiData.taglines || null,

                        // ============================================================================
                        // APP UPDATE — set this field in MongoDB to trigger the update modal
                        // db.appadvisors.updateOne({subdomain:'<tenant>'},{$set:{latestAppVersion:'1.0.5'}})
                        // Consumed by AppUpdateChecker (UpdateAppModal) as the authoritative
                        // version; falls back to Play Store / App Store scraping when null.
                        // ============================================================================
                        latestAppVersion: apiData.latestAppVersion || null,
                        // Platform-specific force-update floors (Android vs iOS can be on
                        // different store versions). UpdateAppModal.pickPlatformVersion()
                        // prefers these over the generic latestAppVersion/minAppVersion.
                        latestAppVersionAndroid: apiData.latestAppVersionAndroid || null,
                        latestAppVersionIos: apiData.latestAppVersionIos || null,
                        minAppVersion: apiData.minAppVersion || null,
                        minAppVersionAndroid: apiData.minAppVersionAndroid || null,
                        minAppVersionIos: apiData.minAppVersionIos || null,
                        forceUpdate: apiData.forceUpdate,

                        // Multi-advisor RA-ID onboarding gate. Only the master
                        // app (b2b / subdomain "prod") sets this true in
                        // appadvisors; every white-label defaults false → the
                        // SignUpRADetails screen self-redirects to Home.
                        raIdOnboardingEnabled: apiData.raIdOnboardingEnabled === true,

                        // ============================================================================
                        // iOS APP STORE ID — set this in MongoDB once the iOS build is live on the
                        // App Store. The "Update Now" button on iOS opens
                        // `https://apps.apple.com/app/id<iosAppStoreId>`. Apple requires the numeric
                        // store ID (e.g. 1234567890), NOT the bundle ID.
                        // db.appadvisors.updateOne({subdomain:'<tenant>'},{$set:{iosAppStoreId:'1234567890'}})
                        // When null, UpdateAppModal's iOS Update CTA is a no-op (no broken URL).
                        // ============================================================================
                        iosAppStoreId: apiData.iosAppStoreId || null,
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
                        googleIosClientId: newConfig.googleIosClientId,
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
                                    // Per-tenant config migrated to appadvisors (see newConfig block
                                    // above). Persisted here so TradeContext's
                                    // configData.config.REACT_APP_* reads the backend value (?? .env).
                                    // Guarded with `|| stored.config?.X` so a transiently-empty API
                                    // response can never blank out a previously-good value.
                                    REACT_APP_ADVISOR_SPECIFIC_TAG: newConfig.REACT_APP_ADVISOR_SPECIFIC_TAG || stored.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
                                    REACT_APP_WHITE_LABEL_TEXT: newConfig.REACT_APP_WHITE_LABEL_TEXT || stored.config?.REACT_APP_WHITE_LABEL_TEXT,
                                    REACT_APP_ADVISOR_SPECIFIER: newConfig.REACT_APP_ADVISOR_SPECIFIER || stored.config?.REACT_APP_ADVISOR_SPECIFIER,
                                    REACT_APP_RAZORPAY_LIVE_API_KEY: newConfig.REACT_APP_RAZORPAY_LIVE_API_KEY || stored.config?.REACT_APP_RAZORPAY_LIVE_API_KEY,
                                    REACT_APP_DIGIO_CHECK: newConfig.REACT_APP_DIGIO_CHECK || stored.config?.REACT_APP_DIGIO_CHECK,
                                    REACT_APP_ADVISOR_LOGO: newConfig.REACT_APP_ADVISOR_LOGO || stored.config?.REACT_APP_ADVISOR_LOGO,
                                    // D3 / Codex T5: persist the parity flags into the same
                                    // AsyncStorage blob TradeContext reads, so useConfig() and
                                    // configData never disagree on a gate.
                                    riaBillingEnabled: newConfig.riaBillingEnabled,
                                    nbaHomeEnabled: newConfig.nbaHomeEnabled,
                                    portfolioHealthEnabled: newConfig.portfolioHealthEnabled,
                                    transitionEngineEnabled: newConfig.transitionEngineEnabled,
                                    voiceSupportUserEnabled: newConfig.voiceSupportUserEnabled,
                                    portfolioHealth: newConfig.portfolioHealth,
                                    performanceSummaryEnabled: newConfig.performanceSummaryEnabled,
                                    kycBlockingEnabled: newConfig.kycBlockingEnabled,
                                    useSharedAngelOneKey: newConfig.useSharedAngelOneKey,
                                    phoneFirstLoginEnabled: newConfig.phoneFirstLoginEnabled,
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
