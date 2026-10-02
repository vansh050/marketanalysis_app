import {
  computeInvestmentTotal,
  resolveGainAwareBase,
} from '../../utils/investmentUpdate';

describe('RB-01 web/mobile gain-aware investment parity', () => {
  test.each([
    ['gain', 100000, 112400, 25000, 137400],
    ['loss', 100000, 88400, 25000, 113400],
    ['rounding', 100000, 100000.51, 1, 100002],
  ])('%s uses reconciled current value plus the entered top-up', (_name, nominal, current, entered, expected) => {
    const base = resolveGainAwareBase({
      enabled: true,
      reconciledValue: current,
      nominalAmount: nominal,
      valuationReliable: true,
    });
    expect(computeInvestmentTotal({mode: 'topup', enteredAmount: entered, baseAmount: base})).toBe(expected);
  });

  test.each([
    ['flag off', false, true, 112400],
    ['unreliable', true, false, 112400],
    ['missing value', true, true, null],
  ])('%s safely falls back to nominal', (_name, enabled, reliable, current) => {
    expect(resolveGainAwareBase({
      enabled,
      reconciledValue: current,
      nominalAmount: 100000,
      valuationReliable: reliable,
    })).toBe(100000);
  });

  test('full amount is an explicit reset and never adds either base', () => {
    expect(computeInvestmentTotal({mode: 'full', enteredAmount: '75000', baseAmount: 112400})).toBe(75000);
  });
});
