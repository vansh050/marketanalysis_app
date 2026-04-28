/**
 * AdvisorConfigService.js
 *
 * Service for managing advisor configurations in the database.
 * Provides CRUD operations for advisor configs with upsert logic
 * (create if subdomain doesn't exist, update if it does).
 *
 * Key Features:
 * - Fetch advisor config by subdomain or RA code
 * - Create or update advisor config (upsert)
 * - Dynamic Digio timing configuration (beforePayment/afterPayment)
 * - Complete UI/branding customization per advisor
 * - All other advisor-specific settings
 *
 * ============================================================================
 * BACKEND API REQUIREMENTS (aq_backend_github)
 * ============================================================================
 *
 * The backend needs to implement the following endpoints:
 *
 * 1. GET /api/app-advisor/get?appSubdomain={subdomain}
 *    - Fetch advisor config by subdomain
 *    - Response: { success: true, data: { ...advisorConfig } }
 *
 * 2. GET /api/advisor-config-env/getConfig/{raCode}
 *    - Fetch advisor config by RA code
 *    - Response: { config: {...}, advisorName: 'Name' }
 *
 * 3. POST /api/app-advisor/create
 *    - Create new advisor config
 *    - Body: { subdomain, appName, digioCheck, ... }
 *    - Should fail if subdomain already exists
 *
 * 4. PUT /api/app-advisor/update
 *    - Update existing advisor config
 *    - Body: { subdomain, ...fieldsToUpdate }
 *
 * 5. PUT /api/app-advisor/update-digio
 *    - Update Digio-specific configuration
 *    - Body: {
 *        subdomain: string,
 *        REACT_APP_DIGIO_CHECK: 'beforePayment' | 'afterPayment',
 *        REACT_APP_DIGIO_ENABLED: boolean,
 *        REACT_APP_OTP_BASED_AUTHENTICATION: boolean
 *      }
 *
 * 6. PUT /api/app-advisor/update-theme
 *    - Update theme/branding configuration
 *    - Body: { subdomain, themeColor, mainColor, logo, ... }
 *
 * 7. GET /api/app-advisor/list
 *    - List all advisor configs (admin only)
 *    - Response: { data: [...configs], count: number }
 *
 * 8. DELETE /api/app-advisor/delete?subdomain={subdomain}
 *    - Delete advisor config
 *
 * ============================================================================
 * COMPLETE DATABASE SCHEMA (supportAQ / aq_backend_github)
 * ============================================================================
 *
 * The backend database should store the following fields for each advisor:
 *
 * --- BASIC INFO ---
 * subdomain: string (required, unique) - e.g., 'zamzamcapital'
 * appName: string - Display name of the advisor app
 *
 * --- CONTACT INFO ---
 * email: string - General contact email
 * supportEmail: string - Support email
 * contactEmail: string - Contact form email
 * adminEmail: string - Admin notifications email
 *
 * --- AUTHENTICATION ---
 * googleWebClientId: string - Google OAuth client ID
 *
 * --- DIGIO CONFIGURATION ---
 * digioCheck: enum('beforePayment', 'afterPayment') - When to trigger Digio
 * digioEnabled: boolean (default: true) - Enable/disable Digio entirely
 * otpBasedAuthentication: boolean (default: false) - Use OTP instead of Aadhaar
 *
 * --- FEATURE FLAGS ---
 * modelPortfolioEnabled: boolean (default: true)
 * bespokePlansEnabled: boolean (default: true)
 *
 * --- PAYMENT CONFIGURATION ---
 * paymentPlatform: enum('razorpay', 'cashfree', 'payu') - Payment gateway
 * razorpayKey: string - Razorpay API key
 * cashfreeAppId: string - Cashfree App ID
 * cashfreeSecretKey: string - Cashfree secret (encrypted)
 * payuMerchantKey: string - PayU merchant key
 * payuMerchantSalt: string - PayU merchant salt (encrypted)
 *
 * --- API KEYS ---
 * advisorSpecificTag: string - Advisor tag for API calls
 * advisorRaCode: string - RA registration code (e.g., 'INA000123456')
 *
 * --- BRANDING & THEME COLORS ---
 * themeColor: string (hex) - Primary theme color
 * logo: string (URL) - Main logo image URL
 * toolbarlogo: string (URL) - Toolbar logo image URL
 * mainColor: string (hex) - Main app color
 * secondaryColor: string (hex) - Secondary color
 * gradient1: string (hex) - Gradient start color
 * gradient2: string (hex) - Gradient end color
 * placeholderText: string (hex) - Placeholder text color
 *
 * --- LAYOUT CONFIGURATION ---
 * homeScreenLayout: enum('layout1', 'layout2') - Home screen variant
 *
 * --- CARD STYLING ---
 * cardBorderWidth: number (default: 0)
 * cardElevation: number (default: 3)
 * cardVerticalMargin: number (default: 3)
 *
 * --- BOTTOM TAB / NAVIGATION STYLING ---
 * tabIconColor: string (hex) - Tab icon color
 * bottomTabBorderTopWidth: number (default: 1.5)
 * bottomTabBg: string (hex) - Bottom tab background
 * selectedTabColor: string (hex) - Selected tab color
 *
 * --- BASKET COLORS ---
 * basket1: string (hex) - Basket gradient start
 * basket2: string (hex) - Basket gradient end
 * basketColor: string (hex) - Basket main color
 * basketSymbolBg: string (hex) - Basket symbol background
 *
 * --- PAYMENT MODAL UI ---
 * paymentModal: {
 *   headerBg: string (hex),
 *   stepActiveColor: string (hex),
 *   stepCompletedColor: string (hex),
 *   buttonPrimaryBg: string (hex),
 *   buttonSecondaryBg: string (hex),
 *   accentColor: string (hex),
 *   checkboxActiveColor: string (hex),
 *   linkColor: string (hex),
 *   progressBarColor: string (hex)
 * }
 *
 * --- EMPTY STATE UI ---
 * emptyStateUi: {
 *   backgroundColor: string (hex),
 *   darkerColor: string (hex),
 *   mediumColor: string (hex),
 *   brighterColor: string (hex),
 *   mutedColor: string (hex),
 *   lightColor: string (hex),
 *   mediumLightShade: string (hex),
 *   lightWarmColor: string (hex)
 * }
 *
 * --- TIMESTAMPS ---
 * createdAt: datetime
 * updatedAt: datetime
 *
 * ============================================================================
 * DIGIO CONFIGURATION
 * ============================================================================
 *
 * The `digioCheck` field controls when Digio verification is triggered:
 *
 * - 'beforePayment': Digio verification opens BEFORE payment flow
 *   User flow: Select Plan -> Digio Verification -> Payment -> Success
 *
 * - 'afterPayment': Digio verification opens AFTER successful payment
 *   User flow: Select Plan -> Payment -> Digio Verification -> Success
 *
 * The `digioEnabled` field can completely disable Digio for an advisor.
 *
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 *
 * // Fetch config for an advisor
 * import { getAdvisorConfig } from './AdvisorConfigService';
 * const result = await getAdvisorConfig('zamzamcapital');
 * if (result.success) {
 *   console.log(result.data);
 * }
 *
 * // Create or update advisor config (upsert)
 * import { createOrUpdateAdvisorConfig } from './AdvisorConfigService';
 * const result = await createOrUpdateAdvisorConfig({
 *   subdomain: 'newadvisor',
 *   appName: 'New Advisor App',
 *   digioCheck: 'afterPayment',
 *   digioEnabled: true,
 *   themeColor: '#1E40AF',
 *   mainColor: '#1E40AF',
 *   homeScreenLayout: 'layout1',
 * });
 *
 * // Update only Digio settings
 * import { updateDigioConfig } from './AdvisorConfigService';
 * await updateDigioConfig('zamzamcapital', {
 *   digioCheck: 'afterPayment',
 *   digioEnabled: true,
 *   otpBasedAuthentication: false,
 * });
 *
 * // Update theme/branding
 * import { updateAdvisorConfig } from './AdvisorConfigService';
 * await updateAdvisorConfig('zamzamcapital', {
 *   themeColor: '#1E40AF',
 *   mainColor: '#1E40AF',
 *   logo: 'https://cdn.example.com/logo.png',
 *   homeScreenLayout: 'layout2',
 * });
 *
 * ============================================================================
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';

// Default config structure for new advisors
// This schema should match the backend database model
// NOTE: Field names use camelCase for API consistency
// ConfigContext.js handles mapping to legacy field names used in UI components
const DEFAULT_ADVISOR_CONFIG = {
  // ============================================================================
  // BASIC INFO
  // ============================================================================
  appName: '',
  subdomain: '',

  // ============================================================================
  // CONTACT INFO
  // ============================================================================
  email: '',
  supportEmail: '',
  contactEmail: '',
  adminEmail: '',

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================
  googleWebClientId: '',

  // ============================================================================
  // DIGIO CONFIGURATION
  // ============================================================================
  // digioCheck: 'beforePayment' or 'afterPayment'
  // - beforePayment: Digio verification BEFORE payment flow
  // - afterPayment: Digio verification AFTER successful payment
  digioCheck: 'beforePayment',
  digioEnabled: true,
  otpBasedAuthentication: false,

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================
  modelPortfolioEnabled: true,
  bespokePlansEnabled: true,

  // ============================================================================
  // PAYMENT CONFIGURATION
  // ============================================================================
  paymentPlatform: 'cashfree', // 'razorpay', 'cashfree', or 'payu'
  razorpayKey: '',
  cashfreeAppId: '',
  cashfreeSecretKey: '',
  payuMerchantKey: '',
  payuMerchantSalt: '',

  // ============================================================================
  // API KEYS
  // ============================================================================
  apiKeys: {
    advisorSpecificTag: '',
    advisorRaCode: '',
  },

  // ============================================================================
  // BRANDING & THEME COLORS
  // All colors should be hex format (#RRGGBB)
  // ============================================================================
  themeColor: '#000000',
  logo: '',           // URL to logo image
  toolbarlogo: '',    // URL to toolbar logo image
  mainColor: '#000000',
  secondaryColor: '#F0F0F0',
  gradient1: '#F0F0F0',
  gradient2: '#F0F0F0',
  placeholderText: '#FFFFFF',

  // ============================================================================
  // LAYOUT CONFIGURATION
  // ============================================================================
  homeScreenLayout: 'layout2', // 'layout1' or 'layout2'

  // ============================================================================
  // CARD STYLING
  // NOTE: API uses camelCase, ConfigContext maps to legacy names:
  // - cardBorderWidth -> CardborderWidth
  // - cardVerticalMargin -> cardverticalmargin
  // ============================================================================
  cardBorderWidth: 0,
  cardElevation: 3,
  cardVerticalMargin: 3,

  // ============================================================================
  // BOTTOM TAB / NAVIGATION STYLING
  // NOTE: API uses camelCase, ConfigContext maps to legacy names:
  // - bottomTabBg -> bottomTabbg
  // - selectedTabColor -> selectedTabcolor
  // ============================================================================
  tabIconColor: '#000',
  bottomTabBorderTopWidth: 1.5,
  bottomTabBg: '#fff',
  selectedTabColor: '#000',

  // ============================================================================
  // BASKET COLORS (for stock basket cards)
  // NOTE: API uses camelCase, ConfigContext maps to legacy names:
  // - basketColor -> basketcolor
  // - basketSymbolBg -> basketsymbolbg
  // ============================================================================
  basket1: '#9D2115',
  basket2: '#6B1207',
  basketColor: '#721E30',
  basketSymbolBg: '#8D2952',

  // ============================================================================
  // PAYMENT MODAL UI CUSTOMIZATION
  // ============================================================================
  paymentModal: {
    headerBg: '#0056B7',
    stepActiveColor: '#0056B7',
    stepCompletedColor: '#29A400',
    buttonPrimaryBg: '#0056B7',
    buttonSecondaryBg: '#0056B7',
    accentColor: '#0056B7',
    checkboxActiveColor: '#29A400',
    linkColor: '#0056B7',
    progressBarColor: '#0056B7',
  },

  // ============================================================================
  // EMPTY STATE UI COLORS
  // NOTE: API uses camelCase (emptyStateUi), ConfigContext also accepts EmptyStateUi
  // ============================================================================
  emptyStateUi: {
    backgroundColor: '#6B1400',
    darkerColor: '#3A0B00',
    mediumColor: '#4D2418',
    brighterColor: '#8B2500',
    mutedColor: '#5A3327',
    lightColor: '#F8E8E5',
    mediumLightShade: '#F5DDD8',
    lightWarmColor: '#E4F1FE',
  },
};

/**
 * Get the standard headers for API requests
 * @param {string} subdomain - The advisor subdomain
 * @returns {Object} Headers object
 */
const getHeaders = (subdomain = 'common') => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': subdomain,
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});

/**
 * Fetch advisor configuration by subdomain
 * @param {string} subdomain - The advisor subdomain
 * @returns {Promise<Object>} The advisor configuration
 */
export const getAdvisorConfig = async subdomain => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const response = await axios.get(
      `${server.server.baseUrl}api/app-advisor/get?appSubdomain=${subdomain}`,
      {
        headers: getHeaders(subdomain),
        timeout: 15000,
      },
    );

    if (response.data?.data) {
      return {
        success: true,
        data: response.data.data,
        exists: true,
      };
    }

    return {
      success: false,
      exists: false,
      error: 'Advisor config not found',
    };
  } catch (error) {
    console.error('Error fetching advisor config:', error);

    if (error.response?.status === 404) {
      return {
        success: false,
        exists: false,
        error: 'Advisor not found',
      };
    }

    return {
      success: false,
      exists: false,
      error: error.message || 'Failed to fetch advisor config',
    };
  }
};

/**
 * Fetch advisor configuration by RA code
 * @param {string} raCode - The advisor RA code
 * @returns {Promise<Object>} The advisor configuration
 */
export const getAdvisorConfigByRaCode = async raCode => {
  try {
    if (!raCode) {
      throw new Error('RA Code is required');
    }

    const normalizedRaCode = raCode.toUpperCase().trim();

    const response = await axios.get(
      `${server.server.baseUrl}api/advisor-config-env/getConfig/${normalizedRaCode}`,
      {
        headers: getHeaders('common'),
        timeout: 15000,
      },
    );

    if (response.data?.config) {
      return {
        success: true,
        data: response.data,
        config: response.data.config,
        advisorName: response.data.advisorName,
        exists: true,
      };
    }

    return {
      success: false,
      exists: false,
      error: 'Advisor config not found',
    };
  } catch (error) {
    console.error('Error fetching advisor config by RA code:', error);

    if (
      error.response?.status === 404 ||
      error.response?.data?.msg === 'Advisor not found'
    ) {
      return {
        success: false,
        exists: false,
        error: 'Advisor not found',
      };
    }

    return {
      success: false,
      exists: false,
      error: error.message || 'Failed to fetch advisor config',
    };
  }
};

/**
 * Create a new advisor configuration
 * @param {Object} configData - The configuration data to create
 * @returns {Promise<Object>} The created configuration
 */
export const createAdvisorConfig = async configData => {
  try {
    if (!configData?.subdomain) {
      throw new Error('Subdomain is required for creating advisor config');
    }

    // Check if subdomain already exists
    const existingConfig = await getAdvisorConfig(configData.subdomain);
    if (existingConfig.exists) {
      return {
        success: false,
        error: 'Advisor with this subdomain already exists. Use update instead.',
        exists: true,
      };
    }

    // Merge with defaults
    const newConfig = {
      ...DEFAULT_ADVISOR_CONFIG,
      ...configData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await axios.post(
      `${server.server.baseUrl}api/app-advisor/create`,
      newConfig,
      {
        headers: getHeaders('common'),
        timeout: 15000,
      },
    );

    return {
      success: true,
      data: response.data,
      message: 'Advisor config created successfully',
    };
  } catch (error) {
    console.error('Error creating advisor config:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create advisor config',
    };
  }
};

/**
 * Update an existing advisor configuration
 * @param {string} subdomain - The advisor subdomain to update
 * @param {Object} configData - The configuration data to update
 * @returns {Promise<Object>} The updated configuration
 */
export const updateAdvisorConfig = async (subdomain, configData) => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required for updating advisor config');
    }

    const updateData = {
      ...configData,
      subdomain, // Ensure subdomain is included
      updatedAt: new Date().toISOString(),
    };

    const response = await axios.put(
      `${server.server.baseUrl}api/app-advisor/update`,
      updateData,
      {
        headers: getHeaders(subdomain),
        timeout: 15000,
      },
    );

    return {
      success: true,
      data: response.data,
      message: 'Advisor config updated successfully',
    };
  } catch (error) {
    console.error('Error updating advisor config:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update advisor config',
    };
  }
};

/**
 * Create or update advisor configuration (Upsert)
 * Creates a new config if subdomain doesn't exist, updates if it does.
 *
 * @param {Object} configData - The configuration data
 * @param {string} configData.subdomain - The advisor subdomain (required)
 * @returns {Promise<Object>} The result of the operation
 */
export const createOrUpdateAdvisorConfig = async configData => {
  try {
    if (!configData?.subdomain) {
      throw new Error('Subdomain is required');
    }

    const subdomain = configData.subdomain.toLowerCase().trim();

    // Check if config already exists
    const existingConfig = await getAdvisorConfig(subdomain);

    if (existingConfig.exists) {
      // Update existing config
      console.log(`Updating existing config for subdomain: ${subdomain}`);
      return await updateAdvisorConfig(subdomain, configData);
    } else {
      // Create new config
      console.log(`Creating new config for subdomain: ${subdomain}`);
      return await createAdvisorConfig({...configData, subdomain});
    }
  } catch (error) {
    console.error('Error in createOrUpdateAdvisorConfig:', error);
    return {
      success: false,
      error: error.message || 'Failed to create or update advisor config',
    };
  }
};

/**
 * Update Digio configuration for an advisor
 * @param {string} subdomain - The advisor subdomain
 * @param {Object} digioConfig - The Digio configuration
 * @param {string} digioConfig.digioCheck - 'beforePayment' or 'afterPayment'
 * @param {boolean} digioConfig.digioEnabled - Whether Digio is enabled
 * @param {boolean} digioConfig.otpBasedAuthentication - Use OTP instead of Aadhaar
 * @returns {Promise<Object>} The result of the operation
 */
export const updateDigioConfig = async (subdomain, digioConfig) => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    // Validate digioCheck value
    if (digioConfig.digioCheck && !['beforePayment', 'afterPayment'].includes(digioConfig.digioCheck)) {
      throw new Error('digioCheck must be either "beforePayment" or "afterPayment"');
    }

    const updateData = {
      subdomain,
      REACT_APP_DIGIO_CHECK: digioConfig.digioCheck,
      REACT_APP_DIGIO_ENABLED: digioConfig.digioEnabled,
      REACT_APP_OTP_BASED_AUTHENTICATION: digioConfig.otpBasedAuthentication,
      updatedAt: new Date().toISOString(),
    };

    const response = await axios.put(
      `${server.server.baseUrl}api/app-advisor/update-digio`,
      updateData,
      {
        headers: getHeaders(subdomain),
        timeout: 15000,
      },
    );

    return {
      success: true,
      data: response.data,
      message: 'Digio config updated successfully',
    };
  } catch (error) {
    console.error('Error updating Digio config:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update Digio config',
    };
  }
};

/**
 * Update theme/branding configuration for an advisor
 * @param {string} subdomain - The advisor subdomain
 * @param {Object} themeConfig - The theme configuration to update
 * @returns {Promise<Object>} The result of the operation
 */
export const updateThemeConfig = async (subdomain, themeConfig) => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const updateData = {
      subdomain,
      // Branding & Theme Colors
      themeColor: themeConfig.themeColor,
      mainColor: themeConfig.mainColor,
      secondaryColor: themeConfig.secondaryColor,
      gradient1: themeConfig.gradient1,
      gradient2: themeConfig.gradient2,
      placeholderText: themeConfig.placeholderText,
      logo: themeConfig.logo,
      toolbarlogo: themeConfig.toolbarlogo,
      // Layout
      homeScreenLayout: themeConfig.homeScreenLayout,
      // Card Styling
      cardBorderWidth: themeConfig.cardBorderWidth,
      cardElevation: themeConfig.cardElevation,
      cardVerticalMargin: themeConfig.cardVerticalMargin,
      // Bottom Tab Styling
      tabIconColor: themeConfig.tabIconColor,
      bottomTabBorderTopWidth: themeConfig.bottomTabBorderTopWidth,
      bottomTabBg: themeConfig.bottomTabBg,
      selectedTabColor: themeConfig.selectedTabColor,
      // Basket Colors
      basket1: themeConfig.basket1,
      basket2: themeConfig.basket2,
      basketColor: themeConfig.basketColor,
      basketSymbolBg: themeConfig.basketSymbolBg,
      // Nested objects
      paymentModal: themeConfig.paymentModal,
      emptyStateUi: themeConfig.emptyStateUi,
      updatedAt: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const response = await axios.put(
      `${server.server.baseUrl}api/app-advisor/update-theme`,
      updateData,
      {
        headers: getHeaders(subdomain),
        timeout: 15000,
      },
    );

    return {
      success: true,
      data: response.data,
      message: 'Theme config updated successfully',
    };
  } catch (error) {
    console.error('Error updating theme config:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update theme config',
    };
  }
};

/**
 * Update feature flags for an advisor
 * @param {string} subdomain - The advisor subdomain
 * @param {Object} featureFlags - The feature flags to update
 * @returns {Promise<Object>} The result of the operation
 */
export const updateFeatureFlags = async (subdomain, featureFlags) => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const updateData = {
      subdomain,
      modelPortfolioEnabled: featureFlags.modelPortfolioEnabled,
      bespokePlansEnabled: featureFlags.bespokePlansEnabled,
      updatedAt: new Date().toISOString(),
    };

    const response = await axios.put(
      `${server.server.baseUrl}api/app-advisor/update`,
      updateData,
      {
        headers: getHeaders(subdomain),
        timeout: 15000,
      },
    );

    return {
      success: true,
      data: response.data,
      message: 'Feature flags updated successfully',
    };
  } catch (error) {
    console.error('Error updating feature flags:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update feature flags',
    };
  }
};

/**
 * Update payment configuration for an advisor
 * @param {string} subdomain - The advisor subdomain
 * @param {Object} paymentConfig - The payment configuration to update
 * @returns {Promise<Object>} The result of the operation
 */
export const updatePaymentConfig = async (subdomain, paymentConfig) => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    // Validate payment platform
    if (paymentConfig.paymentPlatform && !['razorpay', 'cashfree', 'payu'].includes(paymentConfig.paymentPlatform)) {
      throw new Error('Payment platform must be "razorpay", "cashfree", or "payu"');
    }

    const updateData = {
      subdomain,
      paymentPlatform: paymentConfig.paymentPlatform,
      razorpayKey: paymentConfig.razorpayKey,
      cashfreeAppId: paymentConfig.cashfreeAppId,
      cashfreeSecretKey: paymentConfig.cashfreeSecretKey,
      payuMerchantKey: paymentConfig.payuMerchantKey,
      payuMerchantSalt: paymentConfig.payuMerchantSalt,
      updatedAt: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const response = await axios.put(
      `${server.server.baseUrl}api/app-advisor/update`,
      updateData,
      {
        headers: getHeaders(subdomain),
        timeout: 15000,
      },
    );

    return {
      success: true,
      data: response.data,
      message: 'Payment config updated successfully',
    };
  } catch (error) {
    console.error('Error updating payment config:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update payment config',
    };
  }
};

/**
 * Get all advisor configurations (admin only)
 * @returns {Promise<Object>} List of all advisor configurations
 */
export const getAllAdvisorConfigs = async () => {
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/app-advisor/list`,
      {
        headers: getHeaders('common'),
        timeout: 30000,
      },
    );

    return {
      success: true,
      data: response.data?.data || [],
      count: response.data?.count || 0,
    };
  } catch (error) {
    console.error('Error fetching all advisor configs:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Failed to fetch advisor configs',
    };
  }
};

/**
 * Delete an advisor configuration
 * @param {string} subdomain - The advisor subdomain to delete
 * @returns {Promise<Object>} The result of the operation
 */
export const deleteAdvisorConfig = async subdomain => {
  try {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const response = await axios.delete(
      `${server.server.baseUrl}api/app-advisor/delete?subdomain=${subdomain}`,
      {
        headers: getHeaders('common'),
        timeout: 15000,
      },
    );

    return {
      success: true,
      message: 'Advisor config deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting advisor config:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete advisor config',
    };
  }
};

/**
 * Validate advisor configuration
 * @param {Object} configData - The configuration to validate
 * @returns {Object} Validation result with errors if any
 */
export const validateAdvisorConfig = configData => {
  const errors = [];

  if (!configData.subdomain) {
    errors.push('Subdomain is required');
  } else if (!/^[a-z0-9-]+$/.test(configData.subdomain.toLowerCase())) {
    errors.push('Subdomain can only contain lowercase letters, numbers, and hyphens');
  }

  if (!configData.appName) {
    errors.push('App name is required');
  }

  if (configData.digioCheck && !['beforePayment', 'afterPayment'].includes(configData.digioCheck)) {
    errors.push('Digio check must be either "beforePayment" or "afterPayment"');
  }

  if (configData.paymentPlatform && !['razorpay', 'cashfree', 'payu'].includes(configData.paymentPlatform)) {
    errors.push('Payment platform must be "razorpay", "cashfree", or "payu"');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export default {
  getAdvisorConfig,
  getAdvisorConfigByRaCode,
  createAdvisorConfig,
  updateAdvisorConfig,
  createOrUpdateAdvisorConfig,
  updateDigioConfig,
  updateThemeConfig,
  updateFeatureFlags,
  updatePaymentConfig,
  getAllAdvisorConfigs,
  deleteAdvisorConfig,
  validateAdvisorConfig,
  DEFAULT_ADVISOR_CONFIG,
};
