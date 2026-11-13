import fs from 'fs';
import path from 'path';
import {summarizeUnfilledModelLegs} from '../../utils/unfilledModelLegs';

// markup/siddhartha, 13 Nov 2026: 10 of 25 model stocks unheld, ₹17L idle at
// the broker, and the empty plan said "Your Portfolio is Already Aligned!".
describe('summarizeUnfilledModelLegs', () => {
  test('null when the calculation reports no unbought stocks', () => {
    expect(summarizeUnfilledModelLegs(null)).toBeNull();
    expect(summarizeUnfilledModelLegs({buy: [], sell: []})).toBeNull();
    expect(summarizeUnfilledModelLegs({unfilledModelLegs: {symbols: []}})).toBeNull();
  });

  test('names the stocks and keeps only positive amounts', () => {
    const out = summarizeUnfilledModelLegs({
      unfilledModelLegs: {
        symbols: ['SAIL-EQ', 'HAL-EQ'],
        requiredAmount: 1341500,
        suggestedAmount: 1700000,
        availableCash: 'x',
      },
    });
    expect(out.names).toEqual(['SAIL', 'HAL']);
    expect(out.requiredAmount).toBe(1341500);
    expect(out.suggestedAmount).toBe(1700000);
    expect(out.availableCash).toBe(0);
  });
});

describe('RebalanceModal unbought-stocks empty state', () => {
  const modal = fs.readFileSync(
    path.resolve(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
    'utf8',
  );

  test('is checked before "Already Aligned" and never acknowledged as executed', () => {
    const unfilled = modal.indexOf(') : showUnfilledModelLegs ? (');
    const aligned = modal.indexOf('Your Portfolio is Already Aligned!');
    expect(unfilled).toBeGreaterThan(-1);
    expect(aligned).toBeGreaterThan(unfilled);
    expect(modal).toContain(
      'const isAlreadyAlignedCalculation = isZeroTradeCalculation && !unfilledModelLegs;',
    );
  });

  test('add-funds records fund_pending and then recalculates', () => {
    const start = modal.indexOf('const recordUnfilledLegsFunding = async () => {');
    const body = modal.slice(start, modal.indexOf('\n  };\n', start));
    expect(body).toContain('recordFundPendingInstruction(');
    expect(body).toContain('await recalculateRebalance();');
    expect(body.indexOf('recordFundPendingInstruction(')).toBeLessThan(
      body.indexOf('await recalculateRebalance();'),
    );
  });
});
