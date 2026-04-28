// utils/storageUtils.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import server from './serverConfig';
import Config from 'react-native-config';
import { generateToken } from './SecurityTokenManager';

import { getAdvisorSubdomain } from './variantHelper';

// Constants for storage keys (best practice)
const STORAGE_KEYS = {
  RA_ID: '@app:raId',
  USER_DATA: '@app:userData',
  ADVISOR_CONFIG: '@app:advisorConfig',
  HEADER_NAME: '@app:headerName',
  ADVISOR_TAG: '@app:advisorTag',
  ADVISOR_SPECIFIC_TAG: '@app:advisorSpecificTag',
  ADVISOR_LOGO: '@app:advisorLogo',
  ADVISOR_NAME: '@app:advisorName',
  APP_VARIANT: '@app:appVariant',
  ENVIRONMENT: '@app:environment',
  ADVICE_SHOW_DAYS: '@app:adviceShowDays',
  WHITELABEL_TEXT: '@app:whitelabelText',
  RAZORPAY_KEY: '@app:razorpayKey',
  CONFIG_TIMESTAMP: '@app:configTimestamp',
  CONFIG_VERSION: '@app:configVersion',
  MODEL_PORTFOLIO: '@app:modelPortfolio',
  BESPOKE_PLANS: '@app:bespokePlans',
  // Digio configuration - dynamically configurable per advisor
  DIGIO_CHECK: '@app:digioCheck',
  DIGIO_ENABLED: '@app:digioEnabled',
  OTP_BASED_AUTH: '@app:otpBasedAuth',
};

// Legacy keys to clean up on first login with new code
const LEGACY_KEYS = [
  '@app:headerName',
  '@app:advisorTag',
  '@app:advisorSpecificTag',
  '@app:advisorLogo',
  '@app:advisorName',
  '@app:appVariant',
  '@app:environment',
  '@app:adviceShowDays',
  '@app:whitelabelText',
  '@app:razorpayKey',
  '@app:configTimestamp',
  '@app:configVersion',
  '@app:modelPortfolio',
  '@app:bespokePlans',
  '@app:digioCheck',
  '@app:digioEnabled',
  '@app:otpBasedAuth',
];

// Store all login data in one atomic multiSet (3 keys only)
export const storeLoginData = async ({raCode, userData, advisorConfig}) => {
  try {
    const normalizedRaCode = raCode?.toUpperCase()?.trim();
    const batchData = [
      [STORAGE_KEYS.RA_ID, normalizedRaCode || ''],
      [STORAGE_KEYS.USER_DATA, JSON.stringify({
        ...userData,
        lastUpdated: new Date().toISOString(),
      })],
      [STORAGE_KEYS.ADVISOR_CONFIG, JSON.stringify(advisorConfig)],
    ];

    await AsyncStorage.multiSet(batchData);

    // Fire-and-forget: clean up legacy keys
    AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});

    console.log('Login data stored successfully (3 keys)');
    return true;
  } catch (error) {
    console.error('Error storing login data:', error);
    return false;
  }
};

// ENHANCED: Wait for AsyncStorage operations to complete
const waitForAsyncStorage = (ms = 300) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// ENHANCED: Verify data was actually stored
const verifyDataStorage = async raCode => {
  try {
    // console.log('🔍 Verifying data storage...');

    // Wait a bit for AsyncStorage to complete
    await waitForAsyncStorage(500);

    const storedRaId = await AsyncStorage.getItem(STORAGE_KEYS.RA_ID);
    const storedConfig = await AsyncStorage.getItem(
      STORAGE_KEYS.ADVISOR_CONFIG,
    );
    const storedUserData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

    // console.log('storedUswer>>>>>>', storedUserData);

    // console.log('📊 Verification Results:');
    // console.log('- RA ID stored:', !!storedRaId);
    // console.log('- Config stored:', !!storedConfig);
    // console.log('- User data stored:', !!storedUserData);
    // console.log('- RA ID matches:', storedRaId === raCode?.toUpperCase());

    const isComplete = !!(storedRaId && storedConfig && storedUserData);

    if (!isComplete) {
      console.warn('⚠️ Data storage verification failed!');
      console.warn('Missing:', {
        raId: !storedRaId,
        config: !storedConfig,
        userData: !storedUserData,
      });
    }

    return {
      isComplete,
      storedRaId,
      hasConfig: !!storedConfig,
      hasUserData: !!storedUserData,
    };
  } catch (error) {
    console.error('❌ Error verifying data storage:', error);
    return { isComplete: false };
  }
};

// CENTRAL FUNCTION: Check if advisor exists and fetch config (ENHANCED)
export const checkAndFetchAdvisorConfig = async advisorRaCode => {
  try {
    console.log('🔍 Checking advisor config for:', advisorRaCode);

    if (!advisorRaCode) {
      return {
        success: false,
        error: 'No advisor RA code provided',
        advisorExists: false,
      };
    }

    const normalizedRaCode = advisorRaCode.toUpperCase().trim();

    const response = await axios.get(
      `${server.server.baseUrl}api/advisor-config-env/getConfig/${normalizedRaCode}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': 'common',
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        timeout: 15000,
      },
    );

    console.log(
      '📦 Config API Response:',
      JSON.stringify(response.data, null, 2),
    );

    // Check if advisor exists
    if (response.data?.msg === 'Advisor not found' || !response.data?.config) {
      console.warn(`❌ Advisor ${normalizedRaCode} not found`);
      return {
        success: false,
        error: 'Advisor not found',
        advisorExists: false,
      };
    }

    // Advisor exists, store config data with enhanced verification
    console.log('💾 Storing config data...');
    const configStored = await setConfigData(response.data);

    if (configStored) {
      // Store RA ID as well
      await setRaId(normalizedRaCode);

      // ENHANCED: Verify storage was successful
      const verification = await verifyDataStorage(normalizedRaCode);

      if (verification.isComplete) {
        console.log(
          '✅ Config stored and verified successfully for advisor:',
          normalizedRaCode,
        );
        return {
          success: true,
          configData: response.data,
          advisorExists: true,
          message: 'Config fetched, stored, and verified successfully',
        };
      } else {
        console.warn('⚠️ Config stored but verification failed');
        return {
          success: false,
          error: 'Data storage verification failed',
          advisorExists: true,
          configData: response.data,
        };
      }
    } else {
      return {
        success: false,
        error: 'Failed to store config data',
        advisorExists: true,
        configData: response.data,
      };
    }
  } catch (error) {
    console.error('❌ Error checking advisor config:', error);

    // Check for specific error types
    if (
      error.response?.status === 404 ||
      error.response?.data?.msg === 'Advisor not found'
    ) {
      return {
        success: false,
        error: 'Advisor not found',
        advisorExists: false,
      };
    }

    return {
      success: false,
      error: error.message || 'Network error',
      advisorExists: false,
    };
  }
};

// ENHANCED: Get config data with retry mechanism
export const getConfigData = async (retryCount = 3) => {
  try {
    // console.log('📱 Retrieving config data... (Retry:', 4 - retryCount, ')');

    // First try to get the complete config
    const configJson = await AsyncStorage.getItem(STORAGE_KEYS.ADVISOR_CONFIG);

    if (configJson) {
      const parsedConfig = JSON.parse(configJson);

      // Ensure Digio config is available at top level for easier access
      const digioCheck = await AsyncStorage.getItem(STORAGE_KEYS.DIGIO_CHECK);
      const digioEnabled = await AsyncStorage.getItem(STORAGE_KEYS.DIGIO_ENABLED);
      const otpBasedAuth = await AsyncStorage.getItem(STORAGE_KEYS.OTP_BASED_AUTH);

      // Add Digio config at top level if not already present
      const enhancedConfig = {
        ...parsedConfig,
        digioCheck: parsedConfig.digioCheck || digioCheck || parsedConfig?.config?.REACT_APP_DIGIO_CHECK || 'beforePayment',
        digioEnabled: parsedConfig.digioEnabled !== undefined
          ? parsedConfig.digioEnabled
          : (digioEnabled ? JSON.parse(digioEnabled) : true),
        otpBasedAuthentication: parsedConfig.otpBasedAuthentication !== undefined
          ? parsedConfig.otpBasedAuthentication
          : (otpBasedAuth ? JSON.parse(otpBasedAuth) : false),
      };

      console.log('✅ Complete config retrieved successfully');
      return enhancedConfig;
    }

    // If no config found and we have retries left, wait and try again
    if (retryCount > 0) {
      // console.log('⏳ Config not found, waiting and retrying...');
      await waitForAsyncStorage(500);
      return await getConfigData(retryCount - 1);
    }

    // Fallback: Get individual config items if complete config not found
    // console.log('⚠️ Complete config not found, trying individual keys...');
    const individualConfig = await getIndividualConfigItems();

    if (individualConfig && Object.keys(individualConfig).length > 0) {
      // console.log('✅ Individual config items retrieved');
      return individualConfig;
    }

    // console.log('❌ No config data found after all attempts');
    return null;
  } catch (error) {
    console.error('❌ Error retrieving config data:', error);

    // Retry on error if we have attempts left
    if (retryCount > 0) {
      await waitForAsyncStorage(200);
      return await getConfigData(retryCount - 1);
    }

    return null;
  }
};

// Helper function to get individual config items
const getIndividualConfigItems = async () => {
  try {
    const configKeys = Object.values(STORAGE_KEYS).filter(
      key => key !== STORAGE_KEYS.USER_DATA,
    );
    const items = await AsyncStorage.multiGet(configKeys);

    const config = {};
    items.forEach(([key, value]) => {
      if (value) {
        const cleanKey = key.replace('@app:', '');
        try {
          config[cleanKey] =
            value.startsWith('{') || value.startsWith('[')
              ? JSON.parse(value)
              : value;
        } catch {
          config[cleanKey] = value;
        }
      }
    });

    return Object.keys(config).length > 0 ? config : null;
  } catch (error) {
    console.error('❌ Error getting individual config items:', error);
    return null;
  }
};

// ENHANCED: Config data storage with atomic operations
export const setConfigData = async configData => {
  try {
    // console.log('💾 Storing config data with enhanced batch operations...');

    const timestamp = new Date().toISOString();
    const version = configData?.version || '1.0';

    // Prepare batch data for atomic storage
    const batchData = [
      [STORAGE_KEYS.ADVISOR_CONFIG, JSON.stringify(configData)],
      [STORAGE_KEYS.CONFIG_TIMESTAMP, timestamp],
      [STORAGE_KEYS.CONFIG_VERSION, version],
    ];

    // Extract and store individual config values
    if (configData?.config) {
      const config = configData.config;
      batchData.push(
        [STORAGE_KEYS.HEADER_NAME, config.REACT_APP_HEADER_NAME || ''],
        [STORAGE_KEYS.ADVISOR_TAG, config.REACT_APP_ADVISOR_TAG || ''],
        [
          STORAGE_KEYS.ADVISOR_SPECIFIC_TAG,
          config.REACT_APP_ADVISOR_SPECIFIC_TAG || '',
        ],
        [STORAGE_KEYS.ADVISOR_LOGO, config.REACT_APP_ADVISOR_LOGO || ''],
        [STORAGE_KEYS.APP_VARIANT, config.APP_VARIANT || ''],
        [STORAGE_KEYS.ENVIRONMENT, config.REACT_APP_ENV || ''],
        [
          STORAGE_KEYS.ADVICE_SHOW_DAYS,
          String(config.REACT_APP_ADVICE_SHOW_LATEST_DAYS || 15),
        ],
        [STORAGE_KEYS.WHITELABEL_TEXT, config.REACT_APP_WHITE_LABEL_TEXT || ''],
        [
          STORAGE_KEYS.RAZORPAY_KEY,
          config.REACT_APP_RAZORPAY_LIVE_API_KEY || '',
        ],
        [
          STORAGE_KEYS.MODEL_PORTFOLIO,
          JSON.stringify(config.REACT_APP_MODEL_PORTFOLIO_STATUS ?? false),
        ],
        [
          STORAGE_KEYS.BESPOKE_PLANS,
          JSON.stringify(config.REACT_APP_BESPOKE_PLANS_STATUS ?? false),
        ],
        // Digio configuration - dynamically configurable per advisor
        [
          STORAGE_KEYS.DIGIO_CHECK,
          config.REACT_APP_DIGIO_CHECK || config.digioCheck || 'beforePayment',
        ],
        [
          STORAGE_KEYS.DIGIO_ENABLED,
          JSON.stringify(config.REACT_APP_DIGIO_ENABLED !== 'false' && config.digioEnabled !== false),
        ],
        [
          STORAGE_KEYS.OTP_BASED_AUTH,
          JSON.stringify(config.REACT_APP_OTP_BASED_AUTHENTICATION === 'true' || config.otpBasedAuthentication === true),
        ],
      );
    }

    // Also check for Digio config at the top level (from ConfigContext)
    if (configData?.digioCheck) {
      batchData.push([STORAGE_KEYS.DIGIO_CHECK, configData.digioCheck]);
    }
    if (configData?.digioEnabled !== undefined) {
      batchData.push([STORAGE_KEYS.DIGIO_ENABLED, JSON.stringify(configData.digioEnabled)]);
    }
    if (configData?.otpBasedAuthentication !== undefined) {
      batchData.push([STORAGE_KEYS.OTP_BASED_AUTH, JSON.stringify(configData.otpBasedAuthentication)]);
    }

    if (configData?.advisorName) {
      batchData.push([STORAGE_KEYS.ADVISOR_NAME, configData.advisorName]);
    }

    // Use multiSet for better performance and wait for completion
    await AsyncStorage.multiSet(batchData);

    // ENHANCED: Wait for AsyncStorage to complete the operation
    await waitForAsyncStorage(200);

    // console.log(
    //   '✅ Config data stored successfully with enhanced batch operation',
    // );
    return true;
  } catch (error) {
    console.error('❌ Error storing config data:', error);
    return false;
  }
};

// ENHANCED: Get RA ID with retry
export const getRaId = async (retryCount = 2) => {
  try {
    const raId = await AsyncStorage.getItem(STORAGE_KEYS.RA_ID);

    if (!raId && retryCount > 0) {
      await waitForAsyncStorage(200);
      return await getRaId(retryCount - 1);
    }

    return raId;
  } catch (error) {
    console.error('❌ Error retrieving RA ID:', error);
    return null;
  }
};

// ENHANCED: Get user data with retry
export const getUserData = async (retryCount = 2) => {
  try {
    const userDataJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    const userData = userDataJson ? JSON.parse(userDataJson) : null;

    if (!userData && retryCount > 0) {
      await waitForAsyncStorage(200);
      return await getUserData(retryCount - 1);
    }

    return userData;
  } catch (error) {
    console.error('❌ Error retrieving user data:', error);
    return null;
  }
};

// Store RA ID with verification
export const setRaId = async raId => {
  try {
    if (!raId || typeof raId !== 'string') {
      throw new Error('Invalid RA ID provided');
    }

    const normalizedRaId = raId.toUpperCase().trim();
    await AsyncStorage.setItem(STORAGE_KEYS.RA_ID, normalizedRaId);

    // Wait for AsyncStorage to complete
    await waitForAsyncStorage(100);

    // console.log('✅ RA ID stored successfully:', normalizedRaId);
    return true;
  } catch (error) {
    console.error('❌ Error storing RA ID:', error);
    return false;
  }
};

// Store user data with verification
export const setUserData = async userData => {
  try {
    const enhancedUserData = {
      ...userData,
      lastUpdated: new Date().toISOString(),
      version: '1.1',
    };
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_DATA,
      JSON.stringify(enhancedUserData),
    );
    await waitForAsyncStorage(100);
    // Log success
    console.log('User data stored successfully');
    return true;
  } catch (error) {
    // Log error
    console.error('Error storing user data:', error);
    return false;
  }
};

// ENHANCED: Update RA Code and Config with proper synchronization
export const updateRACodeAndConfig = async (newRACode, userEmail) => {
  try {
    // console.log('🔄 Starting enhanced RA Code update process...');
    // console.log('📝 New RA Code:', newRACode);
    // console.log('👤 User Email:', userEmail);

    if (!newRACode || !userEmail) {
      throw new Error('RA Code and User Email are required');
    }

    const normalizedRACode = newRACode.toUpperCase().trim();
    const normalizedEmail = userEmail.toLowerCase().trim();

    // Step 1: Check if advisor exists and fetch config FIRST
    const configResult = await checkAndFetchAdvisorConfig(normalizedRACode);

    if (!configResult.success) {
      return {
        success: false,
        error: configResult.error,
        advisorExists: configResult.advisorExists,
      };
    }

    // Step 2: Update RA code on server (only if advisor exists)
    // console.log('📤 Updating server with new RA Code...');
    const updateResponse = await axios.put(
      `${server.server.baseUrl}api/user/update/user-details`,
      {
        advisor_ra_code: normalizedRACode,
        email: normalizedEmail,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        timeout: 10000,
      },
    );

    // console.log('✅ Server update successful:', updateResponse.status);

    // Step 3: Store user data with enhanced verification
    const userData = {
      raId: normalizedRACode,
      email: normalizedEmail,
      timestamp: new Date().toISOString(),
      profileCompleted: true,
      configFetched: true,
      lastConfigUpdate: new Date().toISOString(),
      configVersion: configResult.configData?.version || '1.1',
      advisorName: configResult.configData?.advisorName || '',
    };

    console.log('userdata>>>>>>>>>>>>', userData);
    await setUserData(userData);

    // Step 4: ENHANCED verification with multiple attempts
    // console.log('🔍 Starting enhanced verification process...');
    let verificationAttempts = 0;
    let verification = {isComplete: false};

    while (!verification.isComplete && verificationAttempts < 3) {
      verificationAttempts++;
      verification = await verifyDataStorage(normalizedRACode);

      if (!verification.isComplete) {
        // console.log(
        //   `⏳ Verification attempt ${verificationAttempts} failed, retrying...`,
        // );
        await waitForAsyncStorage(500);
      }
    }

    if (!verification.isComplete) {
      console.error('❌ Final verification failed after all attempts');
      return {
        success: false,
        error: 'Data storage verification failed after multiple attempts',
        advisorExists: true,
      };
    }

    // console.log('✅ Enhanced verification successful!');
    return {
      success: true,
      configData: configResult.configData,
      message: 'RA Code and config updated successfully with verification',
      advisorExists: true,
    };
  } catch (error) {
    // console.error('❌ Error updating RA code and config:', error);

    let errorMessage = 'Failed to update RA Code';

    if (error.response) {
      errorMessage = `Server Error: ${error.response.status} - ${error.response.data?.message || error.message
        }`;
    } else if (error.request) {
      errorMessage = 'Network Error: Unable to connect to server';
    } else if (error.code === 'TIMEOUT') {
      errorMessage =
        'Request timed out. Please check your connection and try again.';
    } else {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
      advisorExists: false,
    };
  }
};

// ENHANCED: Check if user data is complete with retry
export const isUserDataComplete = async (retryCount = 2) => {
  try {
    const raId = await getRaId();
    const userData = await getUserData();
    const configData = await getConfigData();

    const result = {
      hasRAId: !!raId,
      hasUserData: !!userData,
      hasConfig: !!configData,
      isComplete: !!(raId && userData && configData),
    };

    // If data is incomplete and we have retries, wait and try again
    if (!result.isComplete && retryCount > 0) {
      console.log(
        `⏳ Data incomplete, waiting and retrying... (${retryCount} attempts left)`,
      );
      await waitForAsyncStorage(500);
      return await isUserDataComplete(retryCount - 1);
    }

    return result;
  } catch (error) {
    console.error('Error checking user data completeness:', error);
    return {
      hasRAId: false,
      hasUserData: false,
      hasConfig: false,
      isComplete: false,
    };
  }
};

// Clear all app data
export const clearAllAppData = async () => {
  try {
    const keys = [...Object.values(STORAGE_KEYS), ...LEGACY_KEYS];
    await AsyncStorage.multiRemove(keys);
    await waitForAsyncStorage(200); // Wait for operation to complete
    console.log('✅ Cleared all app data successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing app data:', error);
    return false;
  }
};

// ENHANCED: Force refresh all app data (like your ChangeAdvisor screen)
export const refreshAllAppData = async () => {
  try {
    console.log('🔄 Refreshing all app data...');

    // Wait for any pending AsyncStorage operations
    await waitForAsyncStorage(500);

    // Verify current data
    const dataCheck = await isUserDataComplete();
    console.log('📊 Current data completeness:', dataCheck);

    return dataCheck;
  } catch (error) {
    console.error('❌ Error refreshing app data:', error);
    return {isComplete: false};
  }
};

// Try to auto-resolve advisor from central email_advisor_map.
// Returns { resolved: true, advisor_ra_code, advisor_subdomain } if single match,
// or { resolved: false } if multiple/none (caller should show RA ID screen).
export const tryResolveAdvisor = async email => {
  try {
    if (!email) return {resolved: false};

    const response = await axios.get(
      `${server.server.baseUrl}api/user/resolve-advisor/${encodeURIComponent(
        email.toLowerCase().trim(),
      )}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain':
            Config.REACT_APP_WHITE_LABEL_TEXT || 'alphaquark',
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        timeout: 5000,
      },
    );

    if (response.data?.success && response.data?.auto_resolved) {
      console.log(
        '✅ Auto-resolved advisor:',
        response.data.advisor_ra_code,
      );
      return {
        resolved: true,
        advisor_ra_code: response.data.advisor_ra_code,
        advisor_subdomain: response.data.advisor_subdomain,
      };
    }

    console.log(
      '⚠️ Could not auto-resolve advisor:',
      response.data?.reason,
    );
    return {resolved: false};
  } catch (error) {
    console.error('tryResolveAdvisor error:', error.message);
    return {resolved: false};
  }
};

// Get all stored data (for debugging)
export const getAllStoredData = async () => {
  try {
    const keys = Object.values(STORAGE_KEYS);
    const items = await AsyncStorage.multiGet(keys);

    const data = {};
    items.forEach(([key, value]) => {
      data[key] = value;
    });

    return data;
  } catch (error) {
    console.error('Error getting all stored data:', error);
    return {};
  }
};
