/**
 * Tests for storageUtils.js
 * Matches: Web src/__tests__/services/AuthService.test.js (storage functions)
 * Validates AsyncStorage-based login data, config, and RA code management.
 */

jest.mock('@react-native-async-storage/async-storage');
jest.mock('axios');
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'mock-token'),
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.alphaquark.in/'},
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storeLoginData,
  getConfigData,
  setConfigData,
  getRaId,
  setRaId,
  getUserData,
  setUserData,
  clearAllAppData,
  isUserDataComplete,
} from '../../utils/storageUtils';

describe('storageUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage._reset();
  });

  // ─── storeLoginData ───

  describe('storeLoginData', () => {
    test('stores raCode, userData, and advisorConfig atomically', async () => {
      const result = await storeLoginData({
        raCode: 'INA123456',
        userData: {email: 'test@test.com', name: 'Test'},
        advisorConfig: {config: {REACT_APP_HEADER_NAME: 'test'}},
      });

      expect(result).toBe(true);
      expect(AsyncStorage.multiSet).toHaveBeenCalled();
    });

    test('normalizes raCode to uppercase', async () => {
      await storeLoginData({
        raCode: 'ina123456',
        userData: {},
        advisorConfig: {},
      });

      const batchData = AsyncStorage.multiSet.mock.calls[0][0];
      const raEntry = batchData.find(([key]) => key === '@app:raId');
      expect(raEntry[1]).toBe('INA123456');
    });

    test('handles null raCode gracefully', async () => {
      const result = await storeLoginData({
        raCode: null,
        userData: {},
        advisorConfig: {},
      });
      expect(result).toBe(true);
    });

    test('returns false on storage error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      AsyncStorage.multiSet.mockRejectedValueOnce(new Error('Storage full'));

      const result = await storeLoginData({
        raCode: 'TEST',
        userData: {},
        advisorConfig: {},
      });
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ─── setRaId / getRaId ───

  describe('setRaId / getRaId', () => {
    test('stores and retrieves RA ID', async () => {
      await setRaId('INA123456');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@app:raId', 'INA123456');
    });

    test('normalizes to uppercase', async () => {
      await setRaId('ina123456');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@app:raId', 'INA123456');
    });

    test('rejects invalid RA ID', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await setRaId(null);
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    test('getRaId returns stored value', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('INA123456');
      const raId = await getRaId();
      expect(raId).toBe('INA123456');
    });

    test('getRaId returns null when not set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      // With retries exhausted
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      const raId = await getRaId(0);
      expect(raId).toBeNull();
    });
  });

  // ─── setUserData / getUserData ───

  describe('setUserData / getUserData', () => {
    test('stores user data with timestamp', async () => {
      const result = await setUserData({email: 'test@test.com', name: 'Test'});
      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      const storedValue = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(storedValue.email).toBe('test@test.com');
      expect(storedValue.lastUpdated).toBeDefined();
    });

    test('getUserData parses stored JSON', async () => {
      const mockData = JSON.stringify({email: 'test@test.com', lastUpdated: '2024-01-01'});
      AsyncStorage.getItem.mockResolvedValueOnce(mockData);

      const userData = await getUserData();
      expect(userData.email).toBe('test@test.com');
    });

    test('getUserData returns null when not set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      const userData = await getUserData(0);
      expect(userData).toBeNull();
    });
  });

  // ─── setConfigData / getConfigData ───

  describe('setConfigData / getConfigData', () => {
    test('stores config with batch operation', async () => {
      const config = {
        config: {
          REACT_APP_HEADER_NAME: 'test-advisor',
          REACT_APP_ADVISOR_TAG: 'TEST',
          APP_VARIANT: 'alphaquark',
        },
        advisorName: 'Test Advisor',
      };

      const result = await setConfigData(config);
      expect(result).toBe(true);
      expect(AsyncStorage.multiSet).toHaveBeenCalled();
    });

    test('setConfigData stores config successfully', async () => {
      const result = await setConfigData({
        config: {REACT_APP_HEADER_NAME: 'test-advisor'},
        advisorName: 'TestAdvisor',
      });
      expect(result).toBe(true);

      // Verify the main config key was stored via multiSet
      const storedPairs = AsyncStorage.multiSet.mock.calls[0][0];
      const configPair = storedPairs.find(([key]) => key === '@app:advisorConfig');
      expect(configPair).toBeDefined();

      const parsedConfig = JSON.parse(configPair[1]);
      expect(parsedConfig.config.REACT_APP_HEADER_NAME).toBe('test-advisor');
    });

    test('getConfigData returns null when not set', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      AsyncStorage.multiGet.mockResolvedValue([]);

      const config = await getConfigData(0);
      expect(config).toBeNull();
    });

    test('setConfigData returns false on storage error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      AsyncStorage.multiSet.mockRejectedValueOnce(new Error('Storage full'));

      const result = await setConfigData({config: {}});
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ─── clearAllAppData ───

  describe('clearAllAppData', () => {
    test('clears all storage keys', async () => {
      const result = await clearAllAppData();
      expect(result).toBe(true);
      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });

    test('handles clear errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      AsyncStorage.multiRemove.mockRejectedValueOnce(new Error('fail'));

      const result = await clearAllAppData();
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ─── isUserDataComplete ───

  describe('isUserDataComplete', () => {
    test('returns correct structure with expected properties', async () => {
      const result = await isUserDataComplete(0);
      expect(result).toHaveProperty('hasRAId');
      expect(result).toHaveProperty('hasUserData');
      expect(result).toHaveProperty('hasConfig');
      expect(result).toHaveProperty('isComplete');
      expect(typeof result.isComplete).toBe('boolean');
    });

    test('isComplete is consistent with individual flags', async () => {
      const result = await isUserDataComplete(0);
      if (result.isComplete) {
        expect(result.hasRAId).toBe(true);
        expect(result.hasUserData).toBe(true);
        expect(result.hasConfig).toBe(true);
      }
    });
  });
});
