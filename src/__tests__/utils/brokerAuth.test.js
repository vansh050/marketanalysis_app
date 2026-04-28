/**
 * Tests for brokerAuth.js
 * Validates OAuth state generation, callback registration, URL construction,
 * state persistence (AsyncStorage), and OAuth callback parsing.
 */

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
}));

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.alphaquark.in/'},
    ccxtServer: {baseUrl: 'https://ccxtprod.alphaquark.in/'},
    brokerAuth: {
      callbackUrl: 'https://alphaquark.in/api/deploy/broker/callback',
      registerUrl: 'https://alphaquark.in/api/deploy/broker/register',
    },
  },
}));

// Mock fetch
global.fetch = jest.fn();

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateState,
  registerCallback,
  getAngelOneLoginUrl,
  getAngelOneLoginUrlSync,
  getBrokerCallbackUrl,
  saveOAuthState,
  validateOAuthState,
  clearOAuthState,
  parseOAuthCallback,
  BROKER_OAUTH_CONFIG,
} from '../../utils/brokerAuth';

describe('brokerAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage._reset();
    global.fetch.mockReset();
  });

  // ─── generateState ───

  describe('generateState', () => {
    test('returns base64 encoded JSON string', () => {
      const state = generateState('zerodha');
      expect(typeof state).toBe('string');

      // Decode and parse
      const decoded = JSON.parse(atob(state));
      expect(decoded.broker).toBe('zerodha');
      expect(decoded.platform).toBe('android');
      expect(decoded.timestamp).toBeDefined();
      expect(decoded.nonce).toBeDefined();
      expect(decoded.nonce.length).toBe(32);
    });

    test('includes returnPath', () => {
      const state = generateState('angelone', '/portfolio');
      const decoded = JSON.parse(atob(state));
      expect(decoded.returnPath).toBe('/portfolio');
    });

    test('defaults returnPath to /stock-recommendation', () => {
      const state = generateState('zerodha');
      const decoded = JSON.parse(atob(state));
      expect(decoded.returnPath).toBe('/stock-recommendation');
    });

    test('generates unique nonce each time', () => {
      const state1 = JSON.parse(atob(generateState('zerodha')));
      const state2 = JSON.parse(atob(generateState('zerodha')));
      expect(state1.nonce).not.toBe(state2.nonce);
    });

    test('lowercases broker name', () => {
      const state = generateState('Zerodha');
      const decoded = JSON.parse(atob(state));
      expect(decoded.broker).toBe('zerodha');
    });
  });

  // ─── registerCallback ───

  describe('registerCallback', () => {
    test('calls backend register endpoint', async () => {
      global.fetch.mockResolvedValueOnce({ok: true});

      const nonce = await registerCallback('angelone');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://alphaquark.in/api/deploy/broker/register',
        expect.objectContaining({
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
        }),
      );
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBe(32);
    });

    test('returns nonce even on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const nonce = await registerCallback('angelone');
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBe(32);

      consoleSpy.mockRestore();
    });

    test('sends platform in body', async () => {
      global.fetch.mockResolvedValueOnce({ok: true});

      await registerCallback('angelone', '/test');

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.broker).toBe('angelone');
      expect(body.returnPath).toBe('/test');
      expect(body.platform).toBe('android');
      expect(body.nonce).toBeDefined();
    });
  });

  // ─── getAngelOneLoginUrl ───

  describe('getAngelOneLoginUrl', () => {
    test('constructs Angel One OAuth URL with nonce', async () => {
      global.fetch.mockResolvedValueOnce({ok: true});

      const url = await getAngelOneLoginUrl('my-api-key');
      expect(url).toContain('smartapi.angelbroking.com/publisher-login');
      expect(url).toContain('api_key=my-api-key');
      expect(url).toContain('state=');
    });

    test('uses generateState when nonce fallback disabled', async () => {
      const url = await getAngelOneLoginUrl('key', '/path', false);
      expect(url).toContain('api_key=key');
      // State should be base64-encoded JSON
      const stateMatch = url.match(/state=([^&]+)/);
      expect(stateMatch).toBeDefined();
    });
  });

  describe('getAngelOneLoginUrlSync', () => {
    test('returns URL synchronously', () => {
      const url = getAngelOneLoginUrlSync('sync-key');
      expect(url).toContain('smartapi.angelbroking.com/publisher-login');
      expect(url).toContain('api_key=sync-key');
    });
  });

  // ─── getBrokerCallbackUrl ───

  describe('getBrokerCallbackUrl', () => {
    test('returns centralized callback URL', () => {
      expect(getBrokerCallbackUrl()).toBe(
        'https://alphaquark.in/api/deploy/broker/callback',
      );
    });
  });

  // ─── saveOAuthState / validateOAuthState / clearOAuthState ───

  describe('OAuth state persistence', () => {
    test('save and validate round-trip', async () => {
      await saveOAuthState('zerodha', 'test-state-123');

      const isValid = await validateOAuthState('zerodha', 'test-state-123');
      expect(isValid).toBe(true);
    });

    test('rejects wrong state value', async () => {
      await saveOAuthState('zerodha', 'correct-state');

      const isValid = await validateOAuthState('zerodha', 'wrong-state');
      expect(isValid).toBe(false);
    });

    test('rejects after state expires (10 min)', async () => {
      // Save with old timestamp
      const oldState = JSON.stringify({
        state: 'old-state',
        timestamp: Date.now() - 11 * 60 * 1000, // 11 min ago
      });
      AsyncStorage.getItem.mockResolvedValueOnce(oldState);

      const isValid = await validateOAuthState('zerodha', 'old-state');
      expect(isValid).toBe(false);
    });

    test('rejects when no stored state', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);

      const isValid = await validateOAuthState('zerodha', 'any-state');
      expect(isValid).toBe(false);
    });

    test('clearOAuthState removes stored state', async () => {
      await clearOAuthState('zerodha');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@broker:oauthState:zerodha',
      );
    });

    test('handles AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const isValid = await validateOAuthState('zerodha', 'state');
      expect(isValid).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ─── parseOAuthCallback ───

  describe('parseOAuthCallback', () => {
    test('extracts auth_token from callback URL', () => {
      const result = parseOAuthCallback(
        'https://alphaquark.in/callback?auth_token=abc123&status=success',
      );
      expect(result.authToken).toBe('abc123');
      expect(result.status).toBe('success');
    });

    test('extracts request_token for Zerodha', () => {
      const result = parseOAuthCallback(
        'https://alphaquark.in/callback?request_token=rt_456&status=success',
      );
      expect(result.requestToken).toBe('rt_456');
    });

    test('extracts code for PKCE flow', () => {
      const result = parseOAuthCallback(
        'https://alphaquark.in/callback?code=pkce_code_789&state=encoded_state',
      );
      expect(result.code).toBe('pkce_code_789');
      expect(result.state).toBe('encoded_state');
    });

    test('extracts error_message on failure', () => {
      const result = parseOAuthCallback(
        'https://alphaquark.in/callback?status=error&error_message=User+denied',
      );
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('User denied');
    });

    test('returns null for invalid URL', () => {
      const result = parseOAuthCallback('not-a-url');
      expect(result).toBeNull();
    });

    test('returns null values for missing params', () => {
      const result = parseOAuthCallback('https://alphaquark.in/callback');
      expect(result.authToken).toBeNull();
      expect(result.requestToken).toBeNull();
      expect(result.code).toBeNull();
      expect(result.state).toBeNull();
    });
  });

  // ─── BROKER_OAUTH_CONFIG ───

  describe('BROKER_OAUTH_CONFIG', () => {
    test('contains all expected brokers', () => {
      const expectedBrokers = [
        'Zerodha', 'Angel One', 'Upstox', 'ICICI Direct', 'Fyers',
        'Groww', 'Motilal Oswal', 'Axis Securities', 'Kotak',
        'Dhan', 'AliceBlue', 'IIFL Securities', 'Hdfc Securities',
      ];
      expectedBrokers.forEach(broker => {
        expect(BROKER_OAUTH_CONFIG[broker]).toBeDefined();
      });
    });

    test('OAuth brokers have authType oauth|oauth_nonce|oauth_pkce', () => {
      const oauthBrokers = ['Zerodha', 'Angel One', 'Upstox', 'ICICI Direct', 'Fyers'];
      oauthBrokers.forEach(broker => {
        expect(BROKER_OAUTH_CONFIG[broker].authType).toMatch(/^oauth/);
      });
    });

    test('Credential brokers have authType credential', () => {
      const credBrokers = ['Kotak', 'Dhan', 'AliceBlue', 'IIFL Securities', 'Hdfc Securities'];
      credBrokers.forEach(broker => {
        expect(BROKER_OAUTH_CONFIG[broker].authType).toBe('credential');
      });
    });

    test('Zerodha has daily_6am token expiry', () => {
      expect(BROKER_OAUTH_CONFIG.Zerodha.tokenExpiry).toBe('daily_6am');
    });

    test('Angel One has 24h token expiry', () => {
      expect(BROKER_OAUTH_CONFIG['Angel One'].tokenExpiry).toBe('24h');
    });

    test('Kotak has 1h token expiry', () => {
      expect(BROKER_OAUTH_CONFIG.Kotak.tokenExpiry).toBe('1h');
    });

    test('Kotak requires TOTP', () => {
      expect(BROKER_OAUTH_CONFIG.Kotak.requiresTotp).toBe(true);
      expect(BROKER_OAUTH_CONFIG.Kotak.requiresMpin).toBe(true);
    });

    test('Groww has maxConnections limit', () => {
      expect(BROKER_OAUTH_CONFIG.Groww.maxConnections).toBe(5);
    });
  });
});
