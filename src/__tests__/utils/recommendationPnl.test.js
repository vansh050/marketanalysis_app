import {
  calculateRecommendationPnl,
  getRecommendedEntryPrice,
  isPriceInRecommendedRange,
} from '../../utils/recommendationPnl';

describe('bespoke recommendation P&L', () => {
  it('does not calculate P&L before the recommendation range is reached', () => {
    expect(
      calculateRecommendationPnl({
        ltp: 1772.3,
        entryPrice: 1783,
        action: 'BUY',
        isActivated: false,
      }),
    ).toEqual({pnl: null, changePercent: null});
  });

  it('uses a valid recommended price instead of the push-time price', () => {
    const entryPrice = getRecommendedEntryPrice({
      recommendedPrice: 1783,
      advisedRangeLower: 1783,
      advisedRangeHigher: 1787,
      action: 'BUY',
    });

    expect(entryPrice).toBe(1783);
    expect(
      calculateRecommendationPnl({
        ltp: 1790,
        entryPrice,
        action: 'BUY',
        isActivated: true,
      }).pnl,
    ).toBe(7);
  });

  it('falls back to the actionable range edge for an invalid Price', () => {
    expect(
      getRecommendedEntryPrice({
        recommendedPrice: 1772,
        advisedRangeLower: 1783,
        advisedRangeHigher: 1787,
        action: 'BUY',
      }),
    ).toBe(1783);
    expect(
      getRecommendedEntryPrice({
        recommendedPrice: 1795,
        advisedRangeLower: 1783,
        advisedRangeHigher: 1787,
        action: 'SELL',
      }),
    ).toBe(1787);
  });

  it('calculates SELL P&L in the correct direction', () => {
    expect(
      calculateRecommendationPnl({
        ltp: 1750,
        entryPrice: 1787,
        action: 'SELL',
        isActivated: true,
      }),
    ).toEqual({
      pnl: 37,
      changePercent: (37 / 1787) * 100,
    });
  });

  it('recognises inclusive range entry', () => {
    expect(isPriceInRecommendedRange(1783, 1783, 1787)).toBe(true);
    expect(isPriceInRecommendedRange(1787, 1783, 1787)).toBe(true);
    expect(isPriceInRecommendedRange(1772, 1783, 1787)).toBe(false);
  });

  it('normalises reversed recommendation endpoints', () => {
    expect(isPriceInRecommendedRange(960.35, 970, 958)).toBe(true);
    expect(isPriceInRecommendedRange(958, 970, 958)).toBe(true);
    expect(isPriceInRecommendedRange(970, 970, 958)).toBe(true);
    expect(isPriceInRecommendedRange(957, 970, 958)).toBe(false);
    expect(isPriceInRecommendedRange(971, 970, 958)).toBe(false);

    expect(
      getRecommendedEntryPrice({
        recommendedPrice: 950,
        advisedRangeLower: 970,
        advisedRangeHigher: 958,
        action: 'BUY',
      }),
    ).toBe(958);
  });

  it('does not treat a missing price as outside the advised range', () => {
    // No live quote (feed gap / after hours) must NOT dim the card or fire
    // the soft out-of-range warning — Trade Now / Add to Cart stay active.
    // 2026-08-21: BEML showed no LTP and was falsely warned as out of range.
    expect(isPriceInRecommendedRange(undefined, 1783, 1787)).toBe(true);
    expect(isPriceInRecommendedRange(null, 1783, 1787)).toBe(true);
    expect(isPriceInRecommendedRange('', 1783, 1787)).toBe(true);
    expect(isPriceInRecommendedRange('not-a-number', 1783, 1787)).toBe(true);
  });
});
