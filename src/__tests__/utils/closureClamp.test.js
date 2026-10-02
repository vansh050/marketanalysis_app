import {applyClosureClamps, isClosureLeg} from '../../utils/closureClamp';

const leg = (over = {}) => ({tradeId: 't1', tradingSymbol: 'ANANTRAJ-EQ', quantity: 10, ...over});

describe('B-38b closure clamp (mobile Kite Publisher path)', () => {
  test('a leg with no clamp row passes through unchanged', () => {
    const {next, removed, clamped} = applyClosureClamps([leg()], []);
    expect(next).toEqual([leg()]);
    expect(removed).toEqual([]);
    expect(clamped).toEqual([]);
  });

  test('netOpen below the requested quantity clamps the leg', () => {
    const {next, clamped} = applyClosureClamps([leg()], [{tradeId: 't1', netOpen: 4}]);
    expect(next[0].quantity).toBe(4);
    expect(clamped).toEqual(['ANANTRAJ-EQ (10→4)']);
  });

  test('netOpen at or above the requested quantity leaves it alone', () => {
    const {next, clamped} = applyClosureClamps([leg()], [{tradeId: 't1', netOpen: 10}]);
    expect(next[0].quantity).toBe(10);
    expect(clamped).toEqual([]);
  });

  test('netOpen of zero removes the leg', () => {
    const {next, removed} = applyClosureClamps(
      [leg(), leg({tradeId: 't2', tradingSymbol: 'IDEA-EQ'})],
      [{tradeId: 't1', netOpen: 0}],
    );
    expect(next.map(s => s.tradingSymbol)).toEqual(['IDEA-EQ']);
    expect(removed).toEqual(['ANANTRAJ-EQ']);
  });

  test('tradeIds are matched as strings', () => {
    const {next} = applyClosureClamps([leg({tradeId: 145070541159720})], [{tradeId: '145070541159720', netOpen: 2}]);
    expect(next[0].quantity).toBe(2);
  });

  test('a cart that clamps to nothing is empty, not undefined', () => {
    expect(applyClosureClamps([leg()], [{tradeId: 't1', netOpen: 0}]).next).toEqual([]);
  });

  test.each([
    [{purpose: 'EXIT'}, true],
    [{isClosure: true}, true],
    [{closurestatus: 'fullClose'}, true],
    [{closurestatus: 'partialclose'}, true],
    [{purpose: 'ENTRY'}, false],
    [{}, false],
  ])('isClosureLeg(%p) -> %s', (stock, expected) => {
    expect(isClosureLeg(stock)).toBe(expected);
  });
});
