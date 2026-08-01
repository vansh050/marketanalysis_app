/**
 * Pins the Angel One surveillance filter predicate.
 *
 * This is the whole correctness surface of the pre-trade check: too permissive
 * and customers are warned about tradeable scrips (noise — they learn to
 * ignore the banner); too strict and a genuinely-blocked scrip is fired at
 * Angel One and rejected, which is the bug this check exists to prevent.
 */

import {
  isUnderSurveillance,
  filterSurveillanceStocks,
} from '../../utils/surveillance';

describe('isUnderSurveillance', () => {
  it('flags a found scrip carrying a real surveillance stage', () => {
    expect(isUnderSurveillance({found: true, symbol: 'X', surveillance: 'ASM'})).toBe(true);
    expect(isUnderSurveillance({found: true, symbol: 'X', surveillance: 'GSM'})).toBe(true);
    expect(isUnderSurveillance({found: true, symbol: 'X', surveillance: 'ESM'})).toBe(true);
  });

  it("treats Angel One's 'N' sentinel as NOT under surveillance", () => {
    expect(isUnderSurveillance({found: true, symbol: 'X', surveillance: 'N'})).toBe(false);
  });

  it('ignores rows the broker could not find', () => {
    // found:false means Angel One has no record — not a surveillance verdict.
    expect(isUnderSurveillance({found: false, symbol: 'X', surveillance: 'ASM'})).toBe(false);
  });

  it('ignores empty / missing stages', () => {
    expect(isUnderSurveillance({found: true, symbol: 'X', surveillance: ''})).toBe(false);
    expect(isUnderSurveillance({found: true, symbol: 'X'})).toBe(false);
    expect(isUnderSurveillance({found: true, symbol: 'X', surveillance: null})).toBe(false);
  });

  it('never throws on malformed input', () => {
    // A crash here would take down the trade surface — far worse than a
    // missing warning.
    expect(isUnderSurveillance(null)).toBe(false);
    expect(isUnderSurveillance(undefined)).toBe(false);
    expect(isUnderSurveillance({})).toBe(false);
  });
});

describe('filterSurveillanceStocks', () => {
  it('keeps only the flagged rows', () => {
    const raw = {
      surveillance: [
        {found: true, symbol: 'AAA', surveillance: 'ASM'},
        {found: true, symbol: 'BBB', surveillance: 'N'},
        {found: false, symbol: 'CCC', surveillance: 'GSM'},
        {found: true, symbol: 'DDD', surveillance: 'ESM'},
      ],
    };
    expect(filterSurveillanceStocks(raw).map(r => r.symbol)).toEqual(['AAA', 'DDD']);
  });

  it('returns [] when the endpoint failed open or answered oddly', () => {
    expect(filterSurveillanceStocks(null)).toEqual([]);
    expect(filterSurveillanceStocks(undefined)).toEqual([]);
    expect(filterSurveillanceStocks({})).toEqual([]);
    expect(filterSurveillanceStocks({surveillance: null})).toEqual([]);
    expect(filterSurveillanceStocks({surveillance: 'oops'})).toEqual([]);
  });
});
