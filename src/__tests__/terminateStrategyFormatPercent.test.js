import {formatPercent} from '../screens/Home/TerminateStrategyModal';

describe('TerminateStrategyModal formatPercent', () => {
  test('rounds raw floats to two decimals', () => {
    expect(formatPercent(2.1342819030680326)).toBe('2.13%');
    expect(formatPercent('33.33333')).toBe('33.33%');
    expect(formatPercent(-4.146)).toBe('-4.15%');
  });
  test('keeps "-" for missing or unusable values', () => {
    expect(formatPercent(undefined)).toBe('-');
    expect(formatPercent(0)).toBe('-');
    expect(formatPercent('abc')).toBe('-');
  });
});
