/**
 * brokerAuth.js
 *
 * OAuth flow management for broker authentication.
 * Adapted from prod-alphaquark-github web app for React Native.
 *
 * Handles:
 * - OAuth state parameter generation (CSRF protection)
 * - Nonce-based callback registration (for brokers that don't return state)
 * - Broker-specific login URL construction
 * - Deep link callback URL management
 */

import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import server from './serverConfig';

const OAUTH_STATE_KEY = '@broker:oauthState';

/**
 * Generate OAuth state parameter with CSRF protection.
 * Encodes broker, returnPath, timestamp, and nonce into base64 JSON.
 */
export function generateState(broker, returnPath = '/stock-recommendation') {
  const stateObj = {
    broker: broker.toLowerCase(),
    returnPath,
    timestamp: Date.now(),
    nonce: generateNonce(),
    platform: Platform.OS,
  };

  const stateStr = JSON.stringify(stateObj);
  // Base64 encode for URL safety
  const base64 = btoa(stateStr);
  return base64;
}

/**
 * Register a callback with the backend for brokers that don't reliably return state.
 * Used for Angel One, AliceBlue.
 */
export async function registerCallback(
  broker,
  returnPath = '/stock-recommendation',
) {
  const nonce = generateNonce();
  try {
    const response = await fetch(
      server.brokerAuth.registerUrl,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({broker, returnPath, nonce, platform: Platform.OS}),
      },
    );
    if (!response.ok) {
      throw new Error(`Register callback failed: ${response.status}`);
    }
    return nonce;
  } catch (err) {
    console.error('[brokerAuth] registerCallback error:', err);
    return nonce; // Return nonce anyway for fallback
  }
}

/**
 * Get Angel One OAuth login URL with nonce fallback.
 */
export async function getAngelOneLoginUrl(
  apiKey,
  returnPath = '/stock-recommendation',
  useNonceFallback = true,
) {
  let state;
  if (useNonceFallback) {
    state = await registerCallback('angelone', returnPath);
  } else {
    state = generateState('angelone', returnPath);
  }

  return `https://smartapi.angelbroking.com/publisher-login?api_key=${apiKey}&state=${encodeURIComponent(state)}`;
}

/**
 * Synchronous version — uses generateState instead of registerCallback.
 */
export function getAngelOneLoginUrlSync(apiKey, returnPath) {
  const state = generateState('angelone', returnPath);
  return `https://smartapi.angelbroking.com/publisher-login?api_key=${apiKey}&state=${encodeURIComponent(state)}`;
}

/**
 * Get centralized broker callback URL.
 */
export function getBrokerCallbackUrl() {
  return server.brokerAuth.callbackUrl;
}

/**
 * Save OAuth state to AsyncStorage for validation on callback.
 */
export async function saveOAuthState(broker, state) {
  try {
    await AsyncStorage.setItem(
      `${OAUTH_STATE_KEY}:${broker}`,
      JSON.stringify({state, timestamp: Date.now()}),
    );
  } catch (err) {
    console.error('[brokerAuth] saveOAuthState error:', err);
  }
}

/**
 * Validate OAuth state from callback against stored state.
 */
export async function validateOAuthState(broker, returnedState) {
  try {
    const stored = await AsyncStorage.getItem(`${OAUTH_STATE_KEY}:${broker}`);
    if (!stored) return false;
    const {state, timestamp} = JSON.parse(stored);
    // State expires after 10 minutes
    if (Date.now() - timestamp > 10 * 60 * 1000) {
      await AsyncStorage.removeItem(`${OAUTH_STATE_KEY}:${broker}`);
      return false;
    }
    return state === returnedState;
  } catch (err) {
    console.error('[brokerAuth] validateOAuthState error:', err);
    return false;
  }
}

/**
 * Clear stored OAuth state after use.
 */
export async function clearOAuthState(broker) {
  try {
    await AsyncStorage.removeItem(`${OAUTH_STATE_KEY}:${broker}`);
  } catch (err) {
    console.error('[brokerAuth] clearOAuthState error:', err);
  }
}

/**
 * Parse OAuth callback URL and extract auth parameters.
 */
export function parseOAuthCallback(url) {
  try {
    const urlObj = new URL(url);
    return {
      authToken: urlObj.searchParams.get('auth_token'),
      requestToken: urlObj.searchParams.get('request_token'),
      state: urlObj.searchParams.get('state'),
      code: urlObj.searchParams.get('code'),
      status: urlObj.searchParams.get('status'),
      errorMessage: urlObj.searchParams.get('error_message'),
    };
  } catch {
    return null;
  }
}

/**
 * Broker-specific OAuth configuration.
 */
export const BROKER_OAUTH_CONFIG = {
  Zerodha: {
    authType: 'oauth',
    requiresApiKey: true,
    requiresSecretKey: true,
    loginUrlEndpoint: '/zerodha/login-url',
    callbackEndpoint: '/zerodha/callback',
    tokenGenEndpoint: '/zerodha/gen-access-token',
    tokenExpiry: 'daily_6am',
  },
  'Angel One': {
    authType: 'oauth_nonce',
    requiresApiKey: false, // From env/config
    loginUrlEndpoint: '/angelone/login-url',
    callbackEndpoint: '/angelone/callback',
    tokenExpiry: '24h',
  },
  Upstox: {
    authType: 'oauth_pkce',
    requiresApiKey: true,
    requiresSecretKey: true,
    loginUrlEndpoint: '/upstox/login-url',
    callbackEndpoint: '/upstox/callback',
    tokenGenEndpoint: '/upstox/gen-access-token',
    tokenExpiry: '24h',
  },
  'ICICI Direct': {
    authType: 'oauth',
    requiresApiKey: true,
    requiresSecretKey: true,
    loginUrlEndpoint: '/icici/login-url',
    callbackEndpoint: '/icici/auth-callback',
    tokenExpiry: 'session',
  },
  Fyers: {
    authType: 'oauth',
    requiresApiKey: true,
    requiresSecretKey: true,
    loginUrlEndpoint: '/fyers/login-url',
    tokenExpiry: 'session',
  },
  Groww: {
    // Migrated 2026-04-20 from OAuth PKCE to credential (approval-mode).
    // Re-migrated 2026-04-21 approval-mode → TOTP-seed: second field
    // is now the Base32 TOTP seed, not an approval-mode secret. Seed
    // stored AES-256-CBC server-side; daily refresh is one tap via
    // /api/groww/refresh-token. See components/BrokerConnectionModal/
    // GrowwConnectModal.js, src/utils/growwRefresh.js, and
    // docs/BROKER_CONNECTION.md § Groww.
    authType: 'credential',
    requiresApiKey: true,
    requiresTotpSeed: true,
    tokenGenEndpoint: '/api/groww/update-key',
    refreshEndpoint: '/api/groww/refresh-token',
    tokenExpiry: 'daily_6am_ist',
  },
  'Motilal Oswal': {
    authType: 'oauth',
    requiresApiKey: true,
    requiresSecretKey: false,
    loginUrlEndpoint: '/motilal-oswal/login-url',
    tokenExpiry: 'session',
  },
  'Axis Securities': {
    authType: 'oauth',
    requiresApiKey: false,
    loginUrlEndpoint: '/axis/login-url',
    tokenExpiry: 'session',
  },
  Kotak: {
    authType: 'credential',
    requiresMobile: true,
    requiresMpin: true,
    requiresTotp: true,
    loginUrlEndpoint: '/kotak/login/totp',
    tokenExpiry: '1h',
  },
  Dhan: {
    authType: 'credential',
    requiresClientCode: true,
    requiresJwtToken: true,
    tokenExpiry: 'session',
  },
  AliceBlue: {
    authType: 'credential',
    requiresClientCode: true,
    requiresApiKey: true,
    tokenExpiry: '24h',
  },
  'IIFL Securities': {
    authType: 'credential',
    requiresClientCode: true,
    requiresJwtToken: true,
    tokenExpiry: 'session',
  },
  'Hdfc Securities': {
    authType: 'credential',
    requiresJwtToken: true,
    tokenExpiry: 'session',
  },
};

// --- Internal helpers ---

function generateNonce() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
