import { Linking, Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../utils/safeConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import server from '../utils/serverConfig';

// Storage keys
const ZERODHA_ACCESS_TOKEN_KEY = 'zerodha_access_token';
const ZERODHA_REQUEST_TOKEN_KEY = 'zerodha_request_token';
const ZERODHA_API_KEY_KEY = 'zerodha_api_key';

/**
 * Get Zerodha API key from environment
 */
export const getZerodhaApiKey = () => {
  return Config?.REACT_APP_ZERODHA_API_KEY || '';
};

/**
 * Generate OAuth state parameter for CSRF protection
 */
const generateState = () => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
};

/**
 * Get the deep link redirect URI for OAuth callback
 */
const getRedirectUri = () => {
  const scheme = Config?.REACT_APP_DEEP_LINK_SCHEME || 'rgxapp';
  return `${scheme}://zerodha/callback`;
};

/**
 * Initiate Zerodha OAuth login flow
 * Opens Zerodha login page in browser
 */
export const initiateZerodhaLogin = async (userEmail) => {
  try {
    const apiKey = getZerodhaApiKey();

    if (!apiKey) {
      throw new Error('Zerodha API key not configured');
    }

    // Store API key for later use
    await AsyncStorage.setItem(ZERODHA_API_KEY_KEY, apiKey);

    const redirectUri = getRedirectUri();
    const state = generateState();

    // Store state for validation
    await AsyncStorage.setItem('zerodha_oauth_state', state);
    await AsyncStorage.setItem('zerodha_oauth_user_email', userEmail);

    // Zerodha OAuth URL
    const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&redirect_params=${encodeURIComponent(`state=${state}`)}`;

    console.log('[ZerodhaOAuth] Initiating login:', loginUrl);

    // Open Zerodha login in browser
    const supported = await Linking.canOpenURL(loginUrl);
    if (supported) {
      await Linking.openURL(loginUrl);
      return { success: true };
    } else {
      throw new Error('Cannot open Zerodha login URL');
    }
  } catch (error) {
    console.error('[ZerodhaOAuth] Login initiation failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle OAuth callback from deep link
 * Extracts request_token and exchanges it for access_token
 */
export const handleOAuthCallback = async (url) => {
  try {
    console.log('[ZerodhaOAuth] Received callback URL:', url);

    // Parse URL to get request_token and status
    const urlObj = new URL(url);
    const requestToken = urlObj.searchParams.get('request_token');
    const status = urlObj.searchParams.get('status');
    const state = urlObj.searchParams.get('state');

    // Validate state to prevent CSRF
    const storedState = await AsyncStorage.getItem('zerodha_oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }

    if (status === 'success' && requestToken) {
      console.log('[ZerodhaOAuth] Request token received:', requestToken);

      // Store request token
      await AsyncStorage.setItem(ZERODHA_REQUEST_TOKEN_KEY, requestToken);

      // Exchange request token for access token via backend
      const result = await exchangeRequestToken(requestToken);

      if (result.success) {
        // Clean up temp storage
        await AsyncStorage.removeItem('zerodha_oauth_state');

        return {
          success: true,
          accessToken: result.accessToken,
          message: 'Zerodha connected successfully!'
        };
      } else {
        throw new Error(result.error || 'Failed to exchange token');
      }
    } else {
      throw new Error('OAuth cancelled or failed');
    }
  } catch (error) {
    console.error('[ZerodhaOAuth] Callback handling failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Exchange request token for access token via backend API
 */
const exchangeRequestToken = async (requestToken) => {
  try {
    const apiKey = await AsyncStorage.getItem(ZERODHA_API_KEY_KEY);
    const userEmail = await AsyncStorage.getItem('zerodha_oauth_user_email');

    if (!apiKey) {
      throw new Error('API key not found');
    }

    const baseUrl = Config?.REACT_APP_NODE_SERVER_API_URL || server.server.baseUrl;
    const subdomain = Config?.REACT_APP_ADVISOR_SUBDOMAIN || Config?.REACT_APP_HEADER_NAME || 'rgxresearch';

    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': Config?.REACT_APP_X_ADVISOR_SUBDOMAIN || Config?.REACT_APP_HEADER_NAME || subdomain,
      'aq-encrypted-key': Config?.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(
        Config?.REACT_APP_AQ_KEYS,
        Config?.REACT_APP_AQ_SECRET
      ),
    };

    console.log('[ZerodhaOAuth] Exchanging token with backend...');

    // Call backend API to exchange token and store credentials
    const response = await axios.post(
      `${baseUrl}api/zerodha/oauth/exchange-token`,
      {
        request_token: requestToken,
        api_key: apiKey,
        user_email: userEmail,
      },
      { headers }
    );

    if (response.data && response.data.success) {
      const accessToken = response.data.access_token;

      // Store access token
      await AsyncStorage.setItem(ZERODHA_ACCESS_TOKEN_KEY, accessToken);

      console.log('[ZerodhaOAuth] Access token stored successfully');

      return {
        success: true,
        accessToken: accessToken
      };
    } else {
      throw new Error(response.data?.error || 'Token exchange failed');
    }
  } catch (error) {
    console.error('[ZerodhaOAuth] Token exchange failed:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Get stored access token
 */
export const getAccessToken = async () => {
  try {
    return await AsyncStorage.getItem(ZERODHA_ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('[ZerodhaOAuth] Failed to get access token:', error);
    return null;
  }
};

/**
 * Check if user is authenticated with Zerodha
 */
export const isAuthenticated = async () => {
  const token = await getAccessToken();
  return !!token;
};

/**
 * Logout / disconnect from Zerodha
 */
export const logout = async () => {
  try {
    await AsyncStorage.removeItem(ZERODHA_ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(ZERODHA_REQUEST_TOKEN_KEY);
    await AsyncStorage.removeItem(ZERODHA_API_KEY_KEY);
    await AsyncStorage.removeItem('zerodha_oauth_state');
    await AsyncStorage.removeItem('zerodha_oauth_user_email');

    console.log('[ZerodhaOAuth] Logged out successfully');
    return { success: true };
  } catch (error) {
    console.error('[ZerodhaOAuth] Logout failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Validate if access token is still valid
 * by making a test API call
 */
export const validateToken = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return { valid: false, error: 'No access token found' };
    }

    const baseUrl = Config?.REACT_APP_NODE_SERVER_API_URL || server.server.baseUrl;

    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': Config?.REACT_APP_X_ADVISOR_SUBDOMAIN || Config?.REACT_APP_HEADER_NAME || 'rgxresearch',
      'aq-encrypted-key': Config?.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(
        Config?.REACT_APP_AQ_KEYS,
        Config?.REACT_APP_AQ_SECRET
      ),
    };

    // Call backend to validate token
    const response = await axios.post(
      `${baseUrl}api/zerodha/oauth/validate-token`,
      { access_token: accessToken },
      { headers }
    );

    return {
      valid: response.data.valid || false,
      message: response.data.message
    };
  } catch (error) {
    console.error('[ZerodhaOAuth] Token validation failed:', error);
    return {
      valid: false,
      error: error.response?.data?.error || error.message
    };
  }
};

export default {
  initiateZerodhaLogin,
  handleOAuthCallback,
  getAccessToken,
  isAuthenticated,
  logout,
  validateToken,
  getZerodhaApiKey,
};
