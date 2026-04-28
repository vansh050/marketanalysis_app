/**
 * Tests for symbolNormalizer.js
 * Matches: Web src/__tests__/utils/symbolNormalizer.test.js
 * Validates cross-broker symbol normalization, format conversion, and matching.
 */

import {
  stripSymbolSuffix,
  normalizeSymbol,
  toAngelOneSymbol,
  toZerodhaSymbol,
  toFyersSymbol,
  toUpstoxSymbol,
  toBrokerSymbol,
  symbolsMatch,
  findMatchingSymbol,
} from '../../utils/symbolNormalizer';

describe('symbolNormalizer', () => {
  // ─── stripSymbolSuffix ───

  describe('stripSymbolSuffix', () => {
    test('strips -EQ suffix', () => {
      expect(stripSymbolSuffix('SBIN-EQ')).toBe('SBIN');
    });

    test('strips -BE suffix (BSE equity)', () => {
      expect(stripSymbolSuffix('RELIANCE-BE')).toBe('RELIANCE');
    });

    test('strips -BL suffix', () => {
      expect(stripSymbolSuffix('TCS-BL')).toBe('TCS');
    });

    test('strips -SM suffix', () => {
      expect(stripSymbolSuffix('INFY-SM')).toBe('INFY');
    });

    test('case insensitive suffix stripping', () => {
      expect(stripSymbolSuffix('sbin-eq')).toBe('SBIN');
      expect(stripSymbolSuffix('SBIN-Eq')).toBe('SBIN');
    });

    test('returns empty for null/undefined', () => {
      expect(stripSymbolSuffix(null)).toBe('');
      expect(stripSymbolSuffix(undefined)).toBe('');
      expect(stripSymbolSuffix('')).toBe('');
    });

    test('preserves symbols without suffix', () => {
      expect(stripSymbolSuffix('SBIN')).toBe('SBIN');
      expect(stripSymbolSuffix('RELIANCE')).toBe('RELIANCE');
    });
  });

  // ─── normalizeSymbol ───

  describe('normalizeSymbol', () => {
    test('normalizes plain symbol', () => {
      expect(normalizeSymbol('SBIN')).toBe('SBIN');
    });

    test('removes Fyers exchange prefix (NSE:SBIN-EQ)', () => {
      expect(normalizeSymbol('NSE:SBIN-EQ')).toBe('SBIN');
    });

    test('removes Upstox exchange prefix (NSE_EQ|SBIN)', () => {
      expect(normalizeSymbol('NSE_EQ|SBIN')).toBe('SBIN');
    });

    test('removes Angel One -EQ suffix', () => {
      expect(normalizeSymbol('SBIN-EQ')).toBe('SBIN');
    });

    test('handles combined prefixes and suffixes', () => {
      expect(normalizeSymbol('BSE:RELIANCE-BE')).toBe('RELIANCE');
    });

    test('uppercases the symbol', () => {
      expect(normalizeSymbol('sbin')).toBe('SBIN');
    });

    test('trims whitespace', () => {
      expect(normalizeSymbol('  SBIN  ')).toBe('SBIN');
    });

    test('returns empty for null/undefined', () => {
      expect(normalizeSymbol(null)).toBe('');
      expect(normalizeSymbol(undefined)).toBe('');
    });
  });

  // ─── Broker-specific conversions ───

  describe('toAngelOneSymbol', () => {
    test('adds -EQ for NSE', () => {
      expect(toAngelOneSymbol('SBIN', 'NSE')).toBe('SBIN-EQ');
    });

    test('adds -BE for BSE', () => {
      expect(toAngelOneSymbol('SBIN', 'BSE')).toBe('SBIN-BE');
    });

    test('defaults to -EQ when no exchange', () => {
      expect(toAngelOneSymbol('SBIN')).toBe('SBIN-EQ');
    });

    test('normalizes input first', () => {
      expect(toAngelOneSymbol('NSE:SBIN-EQ', 'NSE')).toBe('SBIN-EQ');
    });
  });

  describe('toZerodhaSymbol', () => {
    test('returns plain symbol', () => {
      expect(toZerodhaSymbol('SBIN-EQ')).toBe('SBIN');
    });

    test('strips all broker prefixes', () => {
      expect(toZerodhaSymbol('NSE:SBIN-EQ')).toBe('SBIN');
      expect(toZerodhaSymbol('NSE_EQ|SBIN')).toBe('SBIN');
    });
  });

  describe('toFyersSymbol', () => {
    test('creates NSE:SYMBOL-EQ format', () => {
      expect(toFyersSymbol('SBIN', 'NSE')).toBe('NSE:SBIN-EQ');
    });

    test('handles BSE exchange', () => {
      expect(toFyersSymbol('SBIN', 'BSE')).toBe('BSE:SBIN-EQ');
    });

    test('defaults to NSE', () => {
      expect(toFyersSymbol('SBIN')).toBe('NSE:SBIN-EQ');
    });
  });

  describe('toUpstoxSymbol', () => {
    test('creates NSE_EQ|SYMBOL format', () => {
      expect(toUpstoxSymbol('SBIN', 'NSE')).toBe('NSE_EQ|SBIN');
    });

    test('defaults to NSE', () => {
      expect(toUpstoxSymbol('SBIN')).toBe('NSE_EQ|SBIN');
    });
  });

  describe('toBrokerSymbol', () => {
    test('routes to correct converter per broker', () => {
      expect(toBrokerSymbol('SBIN', 'NSE', 'Angel One')).toBe('SBIN-EQ');
      expect(toBrokerSymbol('SBIN', 'NSE', 'Zerodha')).toBe('SBIN');
      expect(toBrokerSymbol('SBIN', 'NSE', 'Fyers')).toBe('NSE:SBIN-EQ');
      expect(toBrokerSymbol('SBIN', 'NSE', 'Upstox')).toBe('NSE_EQ|SBIN');
    });

    test('unknown broker returns normalized symbol', () => {
      expect(toBrokerSymbol('SBIN-EQ', 'NSE', 'Dhan')).toBe('SBIN');
    });
  });

  // ─── symbolsMatch ───

  describe('symbolsMatch', () => {
    test('matches same symbol', () => {
      expect(symbolsMatch('SBIN', 'SBIN')).toBe(true);
    });

    test('matches across broker formats', () => {
      expect(symbolsMatch('SBIN-EQ', 'SBIN')).toBe(true);
      expect(symbolsMatch('NSE:SBIN-EQ', 'SBIN')).toBe(true);
      expect(symbolsMatch('NSE_EQ|SBIN', 'NSE:SBIN-EQ')).toBe(true);
    });

    test('case insensitive matching', () => {
      expect(symbolsMatch('sbin', 'SBIN')).toBe(true);
    });

    test('returns false for different symbols', () => {
      expect(symbolsMatch('SBIN', 'RELIANCE')).toBe(false);
    });

    test('returns false for null inputs', () => {
      expect(symbolsMatch(null, 'SBIN')).toBe(false);
      expect(symbolsMatch('SBIN', null)).toBe(false);
    });
  });

  // ─── findMatchingSymbol ───

  describe('findMatchingSymbol', () => {
    test('finds match in string array', () => {
      const arr = ['RELIANCE', 'SBIN-EQ', 'TCS'];
      const match = findMatchingSymbol('SBIN', arr);
      expect(match).toBe('SBIN-EQ');
    });

    test('finds match in object array', () => {
      const arr = [
        {symbol: 'RELIANCE-EQ', qty: 10},
        {symbol: 'NSE:SBIN-EQ', qty: 5},
      ];
      const match = findMatchingSymbol('SBIN', arr);
      expect(match.qty).toBe(5);
    });

    test('uses custom key', () => {
      const arr = [{tradingSymbol: 'SBIN-EQ'}];
      const match = findMatchingSymbol('SBIN', arr, 'tradingSymbol');
      expect(match).toBeDefined();
    });

    test('returns undefined when no match', () => {
      expect(findMatchingSymbol('WIPRO', ['SBIN', 'TCS'])).toBeUndefined();
    });
  });
});
