/**
 * Tests for brokerSessionUtils.js
 * Validates broker token requirements, session freshness,
 * and session validation with Toast notifications.
 */

jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-toast-message');

import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import {
  BROKERS_REQUIRING_TOKEN,
  saveBrokerSessionTime,
  isBrokerSessionFresh,
  validateBrokerSession,
} from '../../utils/brokerSessionUtils';

describe('brokerSessionUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage._reset();
  });

  // ─── BROKERS_REQUIRING_TOKEN ───

  describe('BROKERS_REQUIRING_TOKEN', () => {
    test('includes all major brokers', () => {
      const expectedBrokers = [
        'AliceBlue', 'Angel One', 'Dhan', 'Fyers', 'Groww',
        'Hdfc Securities', 'ICICI Direct', 'IIFL Securities', 'Kotak',
        'Motilal Oswal', 'Upstox', 'Zerodha',
      ];
      expectedBrokers.forEach(broker => {
        expect(BROKERS_REQUIRING_TOKEN).toContain(broker);
      });
    });

    test('has 12 brokers requiring token', () => {
      expect(BROKERS_REQUIRING_TOKEN.length).toBe(12);
    });

    test('does NOT include Axis Securities', () => {
      expect(BROKERS_REQUIRING_TOKEN).not.toContain('Axis Securities');
    });

    test('does NOT include Nuvama', () => {
      expect(BROKERS_REQUIRING_TOKEN).not.toContain('Nuvama');
    });
  });

  // ─── saveBrokerSessionTime ───

  describe('saveBrokerSessionTime', () => {
    test('saves today IST date for broker', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('{}');

      await saveBrokerSessionTime('Zerodha');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const savedValue = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(savedValue.Zerodha).toBeDefined();
      // Should be YYYY-MM-DD format
      expect(savedValue.Zerodha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('preserves other brokers sessions', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({'Angel One': '2024-01-15'}),
      );

      await saveBrokerSessionTime('Zerodha');

      const savedValue = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(savedValue['Angel One']).toBe('2024-01-15');
      expect(savedValue.Zerodha).toBeDefined();
    });

    test('handles AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      await saveBrokerSessionTime('Zerodha');
      // Should not throw
      consoleSpy.mockRestore();
    });
  });

  // ─── isBrokerSessionFresh ───

  describe('isBrokerSessionFresh', () => {
    test('returns true for today session', async () => {
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(today.getTime() + istOffset);
      const todayIST = istDate.toISOString().split('T')[0];

      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({Zerodha: todayIST}),
      );

      const fresh = await isBrokerSessionFresh('Zerodha');
      expect(fresh).toBe(true);
    });

    test('returns false for yesterday session', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({Zerodha: '2020-01-01'}),
      );

      const fresh = await isBrokerSessionFresh('Zerodha');
      expect(fresh).toBe(false);
    });

    test('returns false for missing session', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('{}');

      const fresh = await isBrokerSessionFresh('Zerodha');
      expect(fresh).toBe(false);
    });

    test('returns false on AsyncStorage error', async () => {
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('fail'));

      const fresh = await isBrokerSessionFresh('Zerodha');
      expect(fresh).toBe(false);
    });
  });

  // ─── validateBrokerSession ───

  describe('validateBrokerSession', () => {
    test('returns true for brokers not requiring token', async () => {
      const result = await validateBrokerSession('Axis Securities', null);
      expect(result).toBe(true);
      expect(Toast.show).not.toHaveBeenCalled();
    });

    test('returns false and shows toast when no jwtToken', async () => {
      const result = await validateBrokerSession('Zerodha', null);
      expect(result).toBe(false);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Session Expired',
        }),
      );
    });

    test('returns false for undefined jwtToken', async () => {
      const result = await validateBrokerSession('Angel One', undefined);
      expect(result).toBe(false);
    });

    test('returns false for empty string jwtToken', async () => {
      const result = await validateBrokerSession('Dhan', '');
      expect(result).toBe(false);
    });

    test('returns true with valid token and no freshness check', async () => {
      const result = await validateBrokerSession('Zerodha', 'valid-token');
      expect(result).toBe(true);
      expect(Toast.show).not.toHaveBeenCalled();
    });

    test('checks freshness when option enabled', async () => {
      // Session from today
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(today.getTime() + istOffset);
      const todayIST = istDate.toISOString().split('T')[0];

      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({Zerodha: todayIST}),
      );

      const result = await validateBrokerSession('Zerodha', 'token', {
        checkFreshness: true,
      });
      expect(result).toBe(true);
    });

    test('returns true with warning when session not fresh', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({Zerodha: '2020-01-01'}),
      );

      const result = await validateBrokerSession('Zerodha', 'token', {
        checkFreshness: true,
      });
      // Returns true (lets user try) but shows warning toast
      expect(result).toBe(true);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Session May Have Expired',
        }),
      );
    });
  });
});
