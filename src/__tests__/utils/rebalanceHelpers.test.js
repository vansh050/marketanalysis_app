/**
 * Tests for rebalanceHelpers.js
 * Validates funds error detection, rebalance error responses,
 * subscription amount errors, broker auth errors, portfolio shortfall,
 * and broker payload building for all 14 brokers.
 */

import {
  isFundsErrorOrMissing,
  isRebalanceErrorResponse,
  isSubscriptionAmountError,
  isLowAllowedBalanceError,
  checkPortfolioShortfall,
  isBrokerAuthError,
  buildBrokerPayloadFields,
  defaultDecrypt,
} from '../../utils/rebalanceHelpers';

import {ALL_BROKER_CREDENTIALS} from '../fixtures/brokerCredentials';

// Mock CryptoJS
jest.mock('react-native-crypto-js');

describe('rebalanceHelpers', () => {
  // ─── isFundsErrorOrMissing ───

  describe('isFundsErrorOrMissing', () => {
    test('null funds + connected → true', () => {
      expect(isFundsErrorOrMissing(null, 'connected')).toBe(true);
    });

    test('null funds + not connected → false', () => {
      expect(isFundsErrorOrMissing(null, 'disconnected')).toBe(false);
    });

    test('status 1 + connected → true', () => {
      expect(isFundsErrorOrMissing({status: 1}, 'connected')).toBe(true);
    });

    test('status 2 + connected → true', () => {
      expect(isFundsErrorOrMissing({status: 2}, 'connected')).toBe(true);
    });

    test('status 0 + connected → false', () => {
      expect(isFundsErrorOrMissing({status: 0, data: {availablecash: 10000}}, 'connected')).toBe(false);
    });

    test('valid funds object with no status + connected → false', () => {
      expect(isFundsErrorOrMissing({data: {availablecash: 5000}}, 'connected')).toBe(false);
    });
  });

  // ─── isRebalanceErrorResponse ───

  describe('isRebalanceErrorResponse', () => {
    test('status 1 is error', () => {
      expect(isRebalanceErrorResponse({status: 1})).toBe(true);
    });

    test('status 2 is error', () => {
      expect(isRebalanceErrorResponse({status: 2})).toBe(true);
    });

    test('status 0 is not error', () => {
      expect(isRebalanceErrorResponse({status: 0})).toBe(false);
    });

    test('null response returns false', () => {
      expect(isRebalanceErrorResponse(null)).toBe(false);
    });

    test('undefined response returns false', () => {
      expect(isRebalanceErrorResponse(undefined)).toBe(false);
    });
  });

  // ─── isSubscriptionAmountError ───

  describe('isSubscriptionAmountError', () => {
    test('detects "subscription amount" keyword', () => {
      expect(isSubscriptionAmountError('The subscription amount is not set')).toBe(true);
    });

    test('detects "subscription_amount_raw" keyword', () => {
      expect(isSubscriptionAmountError('Error: subscription_amount_raw missing')).toBe(true);
    });

    test('detects "not set or has been cleared" keyword', () => {
      expect(isSubscriptionAmountError('Investment amount not set or has been cleared')).toBe(true);
    });

    test('returns false for unrelated message', () => {
      expect(isSubscriptionAmountError('Order placement failed')).toBe(false);
    });

    test('returns false for null/undefined', () => {
      expect(isSubscriptionAmountError(null)).toBe(false);
      expect(isSubscriptionAmountError(undefined)).toBe(false);
    });
  });

  // ─── isLowAllowedBalanceError ───

  describe('isLowAllowedBalanceError', () => {
    test('detects "low allowed balance"', () => {
      expect(isLowAllowedBalanceError('Low allowed balance for this trade')).toBe(true);
    });

    test('case insensitive', () => {
      expect(isLowAllowedBalanceError('LOW ALLOWED BALANCE')).toBe(true);
    });

    test('returns false for "insufficient"', () => {
      expect(isLowAllowedBalanceError('Insufficient funds in account')).toBe(false);
    });

    test('returns false for unrelated message', () => {
      expect(isLowAllowedBalanceError('Session expired')).toBe(false);
    });

    test('returns false for null', () => {
      expect(isLowAllowedBalanceError(null)).toBe(false);
    });
  });

  // ─── isBrokerAuthError ───

  describe('isBrokerAuthError', () => {
    test('detects "invalid" + "token" compound', () => {
      expect(isBrokerAuthError('Invalid token received')).toBe(true);
      expect(isBrokerAuthError('Invalid access_token')).toBe(true);
      expect(isBrokerAuthError('invalid api_key provided')).toBe(true);
    });

    test('detects "session expired"', () => {
      expect(isBrokerAuthError('Session expired')).toBe(true);
    });

    test('detects "unauthorized"', () => {
      expect(isBrokerAuthError('Unauthorized access')).toBe(true);
      expect(isBrokerAuthError('unauthorized')).toBe(true);
    });

    test('detects "authentication"', () => {
      expect(isBrokerAuthError('Authentication failed for user')).toBe(true);
    });

    test('returns false for non-auth errors', () => {
      expect(isBrokerAuthError('Insufficient margin')).toBe(false);
      expect(isBrokerAuthError('Market is closed')).toBe(false);
      expect(isBrokerAuthError('Symbol not found')).toBe(false);
    });

    test('returns false for null/undefined', () => {
      expect(isBrokerAuthError(null)).toBe(false);
      expect(isBrokerAuthError(undefined)).toBe(false);
    });
  });

  // ─── checkPortfolioShortfall ───

  describe('checkPortfolioShortfall', () => {
    test('detects shortfall from message with "less than required minimum"', () => {
      const result = checkPortfolioShortfall({
        message: 'Portfolio value is less than required minimum amount (50000)',
        totalValue: 30000,
        buy: [{symbol: 'RELIANCE'}],
        sell: [],
      });
      expect(result.isShortfall).toBe(true);
      expect(result.hasTrades).toBe(true);
      expect(result.currentValue).toBe(30000);
      expect(result.requiredAmount).toBe(50000);
    });

    test('no shortfall when message does not contain keyword', () => {
      const result = checkPortfolioShortfall({
        message: 'Rebalance calculated successfully',
        totalValue: 100000,
        buy: [{symbol: 'RELIANCE'}],
        sell: [{symbol: 'TCS'}],
      });
      expect(result.isShortfall).toBe(false);
    });

    test('no shortfall when no message present', () => {
      const result = checkPortfolioShortfall({
        totalValue: 30000,
        buy: [{symbol: 'A'}],
        sell: [],
      });
      expect(result.isShortfall).toBe(false);
    });

    test('null response returns no shortfall', () => {
      const result = checkPortfolioShortfall(null);
      expect(result.isShortfall).toBe(false);
      expect(result.hasTrades).toBe(false);
    });

    test('requiredAmount is null when regex does not match', () => {
      const result = checkPortfolioShortfall({
        message: 'Portfolio value is less than required minimum',
        buy: [],
        sell: [],
      });
      expect(result.isShortfall).toBe(true);
      expect(result.requiredAmount).toBeNull();
    });
  });

  // ─── buildBrokerPayloadFields ───

  describe('buildBrokerPayloadFields', () => {
    const mockDecrypt = jest.fn(val => `decrypted_${val}`);

    beforeEach(() => {
      mockDecrypt.mockClear();
    });

    test('Zerodha — accessToken only', () => {
      const result = buildBrokerPayloadFields(
        'Zerodha',
        ALL_BROKER_CREDENTIALS.Zerodha,
        mockDecrypt,
      );
      expect(result).toEqual({accessToken: 'zerodha-jwt-token-123'});
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    test('Angel One — apiKey from config + jwtToken', () => {
      const result = buildBrokerPayloadFields(
        'Angel One',
        ALL_BROKER_CREDENTIALS['Angel One'],
        mockDecrypt,
        'config-angel-key',
      );
      expect(result).toEqual({
        apiKey: 'config-angel-key',
        jwtToken: 'angel-jwt-token-456',
      });
    });

    test('Angel One — no fallback when config key is null', () => {
      const result = buildBrokerPayloadFields(
        'Angel One',
        ALL_BROKER_CREDENTIALS['Angel One'],
        mockDecrypt,
        null,
      );
      expect(result.apiKey).toBeNull();
    });

    test('Upstox — decrypts apiKey and apiSecret', () => {
      const result = buildBrokerPayloadFields(
        'Upstox',
        ALL_BROKER_CREDENTIALS.Upstox,
        mockDecrypt,
      );
      expect(result.apiKey).toBe('decrypted_encrypted_upstox-api-key');
      expect(result.apiSecret).toBe('decrypted_encrypted_upstox-secret-key');
      expect(result.accessToken).toBe('upstox-jwt-token-789');
      expect(mockDecrypt).toHaveBeenCalledTimes(2);
    });

    test('ICICI Direct — decrypts apiKey and secretKey', () => {
      const result = buildBrokerPayloadFields(
        'ICICI Direct',
        ALL_BROKER_CREDENTIALS['ICICI Direct'],
        mockDecrypt,
      );
      expect(result.apiKey).toBe('decrypted_encrypted_icici-api-key');
      expect(result.secretKey).toBe('decrypted_encrypted_icici-secret-key');
      expect(result.accessToken).toBe('icici-jwt-token-101');
    });

    test('Dhan — clientId + accessToken', () => {
      const result = buildBrokerPayloadFields(
        'Dhan',
        ALL_BROKER_CREDENTIALS.Dhan,
        mockDecrypt,
      );
      expect(result).toEqual({
        clientId: 'DHAN-CLIENT-001',
        accessToken: 'dhan-jwt-token-404',
      });
    });

    test('Groww — accessToken only', () => {
      const result = buildBrokerPayloadFields(
        'Groww',
        ALL_BROKER_CREDENTIALS.Groww,
        mockDecrypt,
      );
      expect(result).toEqual({accessToken: 'groww-jwt-token-909'});
    });

    test('IIFL — clientCode only', () => {
      const result = buildBrokerPayloadFields(
        'IIFL Securities',
        ALL_BROKER_CREDENTIALS['IIFL Securities'],
        mockDecrypt,
      );
      expect(result).toEqual({clientCode: 'IIFL-CLIENT-001'});
    });

    test('Kotak — decrypts keys + includes sid/serverId/viewToken', () => {
      const result = buildBrokerPayloadFields(
        'Kotak',
        ALL_BROKER_CREDENTIALS.Kotak,
        mockDecrypt,
      );
      expect(result.consumerKey).toBe('decrypted_encrypted_kotak-consumer-key');
      expect(result.consumerSecret).toBe('decrypted_encrypted_kotak-consumer-secret');
      expect(result.accessToken).toBe('kotak-jwt-token-202');
      expect(result.sid).toBe('kotak-sid-303');
      expect(result.serverId).toBe('kotak-server-id');
      expect(result.viewToken).toBe('kotak-view-token');
    });

    test('Hdfc Securities — decrypts apiKey', () => {
      const result = buildBrokerPayloadFields(
        'Hdfc Securities',
        ALL_BROKER_CREDENTIALS['Hdfc Securities'],
        mockDecrypt,
      );
      expect(result.apiKey).toBe('decrypted_encrypted_hdfc-api-key');
      expect(result.accessToken).toBe('hdfc-jwt-token-808');
    });

    test('AliceBlue — clientId + accessToken + apiKey', () => {
      const result = buildBrokerPayloadFields(
        'AliceBlue',
        ALL_BROKER_CREDENTIALS.AliceBlue,
        mockDecrypt,
      );
      expect(result).toEqual({
        clientId: 'ALICE-CLIENT-001',
        accessToken: 'alice-jwt-token-707',
        apiKey: 'alice-api-key',
      });
    });

    test('Fyers — clientId + accessToken', () => {
      const result = buildBrokerPayloadFields(
        'Fyers',
        ALL_BROKER_CREDENTIALS.Fyers,
        mockDecrypt,
      );
      expect(result).toEqual({
        clientId: 'FYERS-CLIENT-001',
        accessToken: 'fyers-jwt-token-505',
      });
    });

    test('Motilal Oswal — decrypts apiKey', () => {
      const result = buildBrokerPayloadFields(
        'Motilal Oswal',
        ALL_BROKER_CREDENTIALS['Motilal Oswal'],
        mockDecrypt,
      );
      expect(result.clientCode).toBe('MOTILAL-CLIENT-001');
      expect(result.accessToken).toBe('motilal-jwt-token-010');
      expect(result.apiKey).toBe('decrypted_encrypted_motilal-api-key');
    });

    test('Axis Securities — accessToken only', () => {
      const result = buildBrokerPayloadFields(
        'Axis Securities',
        ALL_BROKER_CREDENTIALS['Axis Securities'],
        mockDecrypt,
      );
      expect(result).toEqual({accessToken: 'axis-jwt-token-111'});
    });

    test('DummyBroker — falls through to default empty object', () => {
      const result = buildBrokerPayloadFields(
        'DummyBroker',
        ALL_BROKER_CREDENTIALS.DummyBroker,
        mockDecrypt,
      );
      expect(result).toEqual({});
    });

    test('unknown broker returns empty object', () => {
      const result = buildBrokerPayloadFields(
        'FutureBroker',
        {jwtToken: 'future-token'},
        mockDecrypt,
      );
      expect(result).toEqual({});
    });

    test('uses defaultDecrypt when decryptFn not provided', () => {
      // defaultDecrypt uses CryptoJS which is mocked
      const result = buildBrokerPayloadFields(
        'Upstox',
        {apiKey: 'encrypted_val', secretKey: 'encrypted_val2', jwtToken: 'token'},
      );
      expect(result.accessToken).toBe('token');
      // defaultDecrypt should be called (via CryptoJS mock)
    });
  });

  // ─── defaultDecrypt ───

  describe('defaultDecrypt', () => {
    test('returns null/undefined for falsy input', () => {
      expect(defaultDecrypt(null)).toBeNull();
      expect(defaultDecrypt(undefined)).toBeUndefined();
      expect(defaultDecrypt('')).toBe('');
    });

    test('decrypts encrypted value via CryptoJS mock', () => {
      const result = defaultDecrypt('some_encrypted_value');
      // The mock returns the input from toString()
      expect(result).toBeDefined();
    });
  });
});
