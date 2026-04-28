/**
 * Tests for brokerSupport.js
 * Validates broker configuration, order type support, GTT features,
 * and utility functions across all 15 supported brokers.
 */

import {
  BROKER_SUPPORT,
  normalizeBrokerName,
  getBrokerSupport,
  isBrokerAvailable,
  getBrokerUnavailableReason,
  isOrderTypeSupported,
  isFeatureSupported,
  getGTTSupportedBrokers,
  getGTTUnsupportedBrokers,
  getOrderTypeWarning,
  getAvailableOrderTypes,
  ORDER_TYPE_INFO,
  validateOrderConfig,
  getBrokerConnectionMessage,
  formatGTTStatus,
} from '../../utils/brokerSupport';

describe('brokerSupport', () => {
  // ─── Broker Configuration Completeness ───

  describe('BROKER_SUPPORT configuration', () => {
    const EXPECTED_BROKERS = [
      'zerodha', 'upstox', 'angelone', 'dhan', 'fyers',
      'icici', 'groww', 'kotak', 'hdfc', 'iifl',
      'aliceblue', 'motilal_oswal', 'axis', 'nuvama',
    ];

    test('contains all expected brokers', () => {
      EXPECTED_BROKERS.forEach(broker => {
        expect(BROKER_SUPPORT[broker]).toBeDefined();
      });
    });

    test('each broker has required fields', () => {
      Object.entries(BROKER_SUPPORT).forEach(([key, config]) => {
        expect(config.name).toBeDefined();
        expect(config.displayName).toBeDefined();
        expect(config.orderTypes).toBeDefined();
        expect(config.features).toBeDefined();
        expect(typeof config.orderTypes.MARKET).toBe('boolean');
        expect(typeof config.orderTypes.LIMIT).toBe('boolean');
        expect(typeof config.orderTypes.SL).toBe('boolean');
        expect(typeof config.orderTypes.SL_M).toBe('boolean');
        expect(typeof config.orderTypes.GTT).toBe('boolean');
        expect(typeof config.orderTypes.GTT_OCO).toBe('boolean');
      });
    });

    test('all brokers support MARKET and LIMIT orders', () => {
      Object.entries(BROKER_SUPPORT).forEach(([key, config]) => {
        expect(config.orderTypes.MARKET).toBe(true);
        expect(config.orderTypes.LIMIT).toBe(true);
      });
    });
  });

  // ─── GTT Support ───

  describe('GTT broker classification', () => {
    const GTT_BROKERS = ['zerodha', 'upstox', 'angelone', 'dhan', 'fyers', 'icici', 'groww'];
    const NO_GTT_BROKERS = ['kotak', 'hdfc', 'iifl', 'aliceblue', 'motilal_oswal', 'axis', 'nuvama'];

    test('GTT-supported brokers have GTT=true', () => {
      GTT_BROKERS.forEach(broker => {
        expect(BROKER_SUPPORT[broker].orderTypes.GTT).toBe(true);
      });
    });

    test('non-GTT brokers have GTT=false', () => {
      NO_GTT_BROKERS.forEach(broker => {
        expect(BROKER_SUPPORT[broker].orderTypes.GTT).toBe(false);
      });
    });

    test('non-GTT brokers (except Axis/Nuvama) have gttAlternative message', () => {
      ['kotak', 'hdfc', 'iifl', 'aliceblue', 'motilal_oswal'].forEach(broker => {
        expect(BROKER_SUPPORT[broker].gttAlternative).toBeDefined();
        expect(typeof BROKER_SUPPORT[broker].gttAlternative).toBe('string');
      });
    });
  });

  describe('GTT OCO support', () => {
    test('OCO-supported brokers', () => {
      const ocoBrokers = ['zerodha', 'upstox', 'dhan', 'fyers', 'icici', 'groww'];
      ocoBrokers.forEach(broker => {
        expect(BROKER_SUPPORT[broker].orderTypes.GTT_OCO).toBe(true);
      });
    });

    test('Angel One has GTT but NOT OCO', () => {
      expect(BROKER_SUPPORT.angelone.orderTypes.GTT).toBe(true);
      expect(BROKER_SUPPORT.angelone.orderTypes.GTT_OCO).toBe(false);
    });
  });

  describe('GTT max orders', () => {
    test('Zerodha allows 50 GTT orders', () => {
      expect(BROKER_SUPPORT.zerodha.features.gtt_max_orders).toBe(50);
    });

    test('Upstox allows 100 GTT orders', () => {
      expect(BROKER_SUPPORT.upstox.features.gtt_max_orders).toBe(100);
    });

    test('Dhan allows 100 GTT orders', () => {
      expect(BROKER_SUPPORT.dhan.features.gtt_max_orders).toBe(100);
    });
  });

  // ─── SL/SL_M Support ───

  describe('Stop Loss support', () => {
    test('Axis Securities does NOT support SL or SL_M', () => {
      expect(BROKER_SUPPORT.axis.orderTypes.SL).toBe(false);
      expect(BROKER_SUPPORT.axis.orderTypes.SL_M).toBe(false);
    });

    test('all other brokers support SL and SL_M', () => {
      Object.entries(BROKER_SUPPORT)
        .filter(([key]) => key !== 'axis')
        .forEach(([key, config]) => {
          expect(config.orderTypes.SL).toBe(true);
          expect(config.orderTypes.SL_M).toBe(true);
        });
    });
  });

  // ─── Broker Availability ───

  describe('broker availability', () => {
    test('IIFL is marked unavailable', () => {
      expect(BROKER_SUPPORT.iifl.unavailable).toBe(true);
      expect(isBrokerAvailable('IIFL Securities')).toBe(false);
    });

    test('IIFL has unavailability reason', () => {
      expect(BROKER_SUPPORT.iifl.unavailableReason).toBeDefined();
      expect(getBrokerUnavailableReason('IIFL Securities')).toContain('temporarily unavailable');
    });

    test('other brokers are available', () => {
      ['Zerodha', 'Angel One', 'Upstox', 'Dhan', 'Fyers', 'Groww'].forEach(broker => {
        expect(isBrokerAvailable(broker)).toBe(true);
      });
    });

    test('unknown brokers are assumed available', () => {
      expect(isBrokerAvailable('UnknownBroker')).toBe(true);
    });

    test('unknown brokers have null unavailable reason', () => {
      expect(getBrokerUnavailableReason('UnknownBroker')).toBeNull();
    });
  });

  // ─── Angel One Surveillance ───

  describe('Angel One surveillance', () => {
    test('Angel One has surveillanceCheck flag', () => {
      expect(BROKER_SUPPORT.angelone.surveillanceCheck).toBe(true);
    });

    test('other brokers do not have surveillanceCheck', () => {
      Object.entries(BROKER_SUPPORT)
        .filter(([key]) => key !== 'angelone')
        .forEach(([key, config]) => {
          expect(config.surveillanceCheck).toBeUndefined();
        });
    });
  });

  // ─── normalizeBrokerName ───

  describe('normalizeBrokerName', () => {
    test('normalizes various broker name formats', () => {
      expect(normalizeBrokerName('Angel One')).toBe('angelone');
      expect(normalizeBrokerName('angel')).toBe('angelone');
      expect(normalizeBrokerName('AngelOne')).toBe('angelone');
      expect(normalizeBrokerName('Zerodha')).toBe('zerodha');
      expect(normalizeBrokerName('Kite')).toBe('zerodha');
      expect(normalizeBrokerName('ICICI Direct')).toBe('icici');
      expect(normalizeBrokerName('icici')).toBe('icici');
      expect(normalizeBrokerName('HDFC Securities')).toBe('hdfc');
      expect(normalizeBrokerName('Alice Blue')).toBe('aliceblue');
      expect(normalizeBrokerName('Motilal Oswal')).toBe('motilal_oswal');
      expect(normalizeBrokerName('Axis Direct')).toBe('axis');
      expect(normalizeBrokerName('Kotak Securities')).toBe('kotak');
    });

    test('handles null/empty input', () => {
      expect(normalizeBrokerName(null)).toBeNull();
      expect(normalizeBrokerName(undefined)).toBeNull();
      expect(normalizeBrokerName('')).toBeNull();
    });

    test('converts unknown brokers using underscore replacement', () => {
      expect(normalizeBrokerName('Some New Broker')).toBe('some_new_broker');
    });
  });

  // ─── getBrokerSupport ───

  describe('getBrokerSupport', () => {
    test('returns config for valid brokers', () => {
      const config = getBrokerSupport('Zerodha');
      expect(config).toBeDefined();
      expect(config.name).toBe('Zerodha');
    });

    test('returns null for unknown broker', () => {
      expect(getBrokerSupport('NonExistentBroker')).toBeNull();
    });

    test('is case-insensitive via normalization', () => {
      expect(getBrokerSupport('zerodha')).toBeDefined();
      expect(getBrokerSupport('ZERODHA')).toBeDefined(); // normalizeBrokerName lowercases
    });
  });

  // ─── isOrderTypeSupported ───

  describe('isOrderTypeSupported', () => {
    test('returns true for supported order types', () => {
      expect(isOrderTypeSupported('Zerodha', 'MARKET')).toBe(true);
      expect(isOrderTypeSupported('Zerodha', 'GTT')).toBe(true);
      expect(isOrderTypeSupported('Zerodha', 'GTT_OCO')).toBe(true);
    });

    test('returns false for unsupported order types', () => {
      expect(isOrderTypeSupported('Kotak', 'GTT')).toBe(false);
      expect(isOrderTypeSupported('Axis Securities', 'SL')).toBe(false);
    });

    test('returns false for unknown broker', () => {
      expect(isOrderTypeSupported('UnknownBroker', 'MARKET')).toBeFalsy();
    });
  });

  // ─── isFeatureSupported ───

  describe('isFeatureSupported', () => {
    test('returns true for supported features', () => {
      expect(isFeatureSupported('Zerodha', 'slpt')).toBe(true);
      expect(isFeatureSupported('Zerodha', 'oco')).toBe(true);
      expect(isFeatureSupported('Zerodha', 'gtt_multi_leg')).toBe(true);
    });

    test('returns false for unsupported features', () => {
      expect(isFeatureSupported('Kotak', 'oco')).toBe(false);
      expect(isFeatureSupported('Axis Securities', 'slpt')).toBe(false);
    });

    test('Nuvama supports GTC', () => {
      expect(isFeatureSupported('nuvama', 'gtc')).toBe(true);
    });
  });

  // ─── getGTTSupportedBrokers / getGTTUnsupportedBrokers ───

  describe('getGTTSupportedBrokers', () => {
    test('returns array of GTT-capable brokers', () => {
      const gttBrokers = getGTTSupportedBrokers();
      expect(gttBrokers.length).toBeGreaterThanOrEqual(7);
      expect(gttBrokers.some(b => b.key === 'zerodha')).toBe(true);
      expect(gttBrokers.some(b => b.key === 'kotak')).toBe(false);
    });

    test('each entry has key, name, hasOCO, hasMultiLeg', () => {
      const gttBrokers = getGTTSupportedBrokers();
      gttBrokers.forEach(b => {
        expect(b.key).toBeDefined();
        expect(b.name).toBeDefined();
        expect(typeof b.hasOCO).toBe('boolean');
        expect(typeof b.hasMultiLeg).toBe('boolean');
      });
    });
  });

  describe('getGTTUnsupportedBrokers', () => {
    test('returns array of non-GTT brokers', () => {
      const noGttBrokers = getGTTUnsupportedBrokers();
      expect(noGttBrokers.length).toBeGreaterThanOrEqual(7);
      expect(noGttBrokers.some(b => b.key === 'kotak')).toBe(true);
      expect(noGttBrokers.some(b => b.key === 'zerodha')).toBe(false);
    });
  });

  // ─── getOrderTypeWarning ───

  describe('getOrderTypeWarning', () => {
    test('returns null for supported order types', () => {
      expect(getOrderTypeWarning('Zerodha', 'GTT')).toBeNull();
      expect(getOrderTypeWarning('Zerodha', 'MARKET')).toBeNull();
    });

    test('returns warning for unsupported GTT', () => {
      const warning = getOrderTypeWarning('Kotak', 'GTT');
      expect(warning).toBeDefined();
      expect(warning.title).toBe('GTT Not Supported');
      expect(warning.severity).toBe('warning');
      expect(warning.alternative).toBeDefined();
    });

    test('returns error for unsupported SL', () => {
      const warning = getOrderTypeWarning('Axis Securities', 'SL');
      expect(warning).toBeDefined();
      expect(warning.title).toBe('Stop Loss Not Supported');
      expect(warning.severity).toBe('error');
    });

    test('OCO warning severity is info when GTT is supported', () => {
      const warning = getOrderTypeWarning('Angel One', 'GTT_OCO');
      expect(warning.severity).toBe('info');
    });

    test('OCO warning severity is warning when GTT not supported', () => {
      const warning = getOrderTypeWarning('Kotak', 'GTT_OCO');
      expect(warning.severity).toBe('warning');
    });

    test('returns generic warning for unknown order type', () => {
      const warning = getOrderTypeWarning('Zerodha', 'UNKNOWN_TYPE');
      expect(warning).toBeDefined();
      expect(warning.severity).toBe('error');
    });

    test('returns error for unknown broker', () => {
      const warning = getOrderTypeWarning('UnknownBroker', 'MARKET');
      expect(warning).toContain('Unknown broker');
    });
  });

  // ─── getAvailableOrderTypes ───

  describe('getAvailableOrderTypes', () => {
    test('Zerodha supports all order types', () => {
      const types = getAvailableOrderTypes('Zerodha');
      expect(types).toContain('MARKET');
      expect(types).toContain('LIMIT');
      expect(types).toContain('SL');
      expect(types).toContain('GTT');
      expect(types).toContain('GTT_OCO');
      expect(types).toHaveLength(6);
    });

    test('Axis Securities supports only MARKET and LIMIT', () => {
      const types = getAvailableOrderTypes('Axis Securities');
      expect(types).toContain('MARKET');
      expect(types).toContain('LIMIT');
      expect(types).toHaveLength(2);
    });

    test('unknown broker defaults to MARKET and LIMIT', () => {
      const types = getAvailableOrderTypes('UnknownBroker');
      expect(types).toEqual(['MARKET', 'LIMIT']);
    });
  });

  // ─── ORDER_TYPE_INFO ───

  describe('ORDER_TYPE_INFO', () => {
    test('all 6 order types have info', () => {
      ['MARKET', 'LIMIT', 'SL', 'SL_M', 'GTT', 'GTT_OCO'].forEach(type => {
        expect(ORDER_TYPE_INFO[type]).toBeDefined();
        expect(ORDER_TYPE_INFO[type].label).toBeDefined();
        expect(ORDER_TYPE_INFO[type].description).toBeDefined();
      });
    });

    test('MARKET does not require price', () => {
      expect(ORDER_TYPE_INFO.MARKET.requiresPrice).toBe(false);
      expect(ORDER_TYPE_INFO.MARKET.requiresTriggerPrice).toBe(false);
    });

    test('LIMIT requires price but not trigger', () => {
      expect(ORDER_TYPE_INFO.LIMIT.requiresPrice).toBe(true);
      expect(ORDER_TYPE_INFO.LIMIT.requiresTriggerPrice).toBe(false);
    });

    test('SL requires both price and trigger', () => {
      expect(ORDER_TYPE_INFO.SL.requiresPrice).toBe(true);
      expect(ORDER_TYPE_INFO.SL.requiresTriggerPrice).toBe(true);
    });

    test('GTT_OCO requires target and stoploss', () => {
      expect(ORDER_TYPE_INFO.GTT_OCO.requiresTargetPrice).toBe(true);
      expect(ORDER_TYPE_INFO.GTT_OCO.requiresStoplossPrice).toBe(true);
    });
  });

  // ─── validateOrderConfig ───

  describe('validateOrderConfig', () => {
    test('valid MARKET order passes', () => {
      const result = validateOrderConfig(
        {orderType: 'MARKET', quantity: 10, symbol: 'RELIANCE'},
        'Zerodha',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('LIMIT order without price fails', () => {
      const result = validateOrderConfig(
        {orderType: 'LIMIT', quantity: 10, symbol: 'RELIANCE'},
        'Zerodha',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('price'))).toBe(true);
    });

    test('missing quantity fails', () => {
      const result = validateOrderConfig(
        {orderType: 'MARKET', quantity: 0, symbol: 'RELIANCE'},
        'Zerodha',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Quantity'))).toBe(true);
    });

    test('missing symbol fails', () => {
      const result = validateOrderConfig(
        {orderType: 'MARKET', quantity: 10},
        'Zerodha',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Symbol'))).toBe(true);
    });

    test('unsupported order type for broker adds warning', () => {
      const result = validateOrderConfig(
        {orderType: 'GTT', quantity: 10, symbol: 'RELIANCE', price: 100, triggerPrice: 95},
        'Kotak',
      );
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('SL on Axis returns error (not just warning)', () => {
      const result = validateOrderConfig(
        {orderType: 'SL', quantity: 10, symbol: 'RELIANCE', price: 100, triggerPrice: 95},
        'Axis Securities',
      );
      expect(result.valid).toBe(false);
    });

    test('unknown broker returns error', () => {
      const result = validateOrderConfig(
        {orderType: 'MARKET', quantity: 10, symbol: 'RELIANCE'},
        'TotallyFakeBroker',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown broker'))).toBe(true);
    });

    test('suggests SL fallback when GTT unsupported but SL is', () => {
      const result = validateOrderConfig(
        {orderType: 'GTT', quantity: 10, symbol: 'RELIANCE', price: 100, triggerPrice: 95},
        'Kotak',
      );
      expect(result.suggestedFallback).toBe('SL');
    });
  });

  // ─── getBrokerConnectionMessage ───

  describe('getBrokerConnectionMessage', () => {
    test('connected status', () => {
      const msg = getBrokerConnectionMessage('connected', 'Zerodha');
      expect(msg.type).toBe('success');
      expect(msg.message).toContain('Zerodha');
    });

    test('disconnected status', () => {
      const msg = getBrokerConnectionMessage('disconnected', 'Dhan');
      expect(msg.type).toBe('warning');
      expect(msg.action).toBe('Connect Broker');
    });

    test('token_expired status', () => {
      const msg = getBrokerConnectionMessage('token_expired', 'Angel One');
      expect(msg.type).toBe('error');
      expect(msg.action).toBe('Reconnect');
    });

    test('unknown status defaults to error', () => {
      const msg = getBrokerConnectionMessage('random_status', 'Zerodha');
      expect(msg.type).toBe('error');
    });
  });

  // ─── formatGTTStatus ───

  describe('formatGTTStatus', () => {
    test('maps known statuses', () => {
      expect(formatGTTStatus('ACTIVE').color).toBe('green');
      expect(formatGTTStatus('TRIGGERED').color).toBe('blue');
      expect(formatGTTStatus('CANCELLED').color).toBe('gray');
      expect(formatGTTStatus('EXPIRED').color).toBe('orange');
      expect(formatGTTStatus('REJECTED').color).toBe('red');
      expect(formatGTTStatus('EXECUTED').color).toBe('green');
    });

    test('unknown status defaults to gray', () => {
      const status = formatGTTStatus('RANDOM');
      expect(status.label).toBe('RANDOM');
      expect(status.color).toBe('gray');
    });
  });
});
