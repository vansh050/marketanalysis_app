/**
 * Invest now crashed with "Cannot read property 'onetimeOptions' of null"
 * when the plan detail had not loaded (2026-10-13, Kyzen bespoke detail).
 */
jest.mock('../utils/gstHelpers', () => ({withGst: n => n}));
const {calculatePlanPaymentAmount} = require('../hooks/usePlanPaymentAmount');

test('a null plan yields 0 instead of throwing', () => {
  expect(calculatePlanPaymentAmount({specificPlan: null, selectedPlanType: 'onetime'})).toBe(0);
  expect(calculatePlanPaymentAmount({specificPlan: null, selectedPlanType: 'recurring', selectedCard: 'monthly'})).toBe(0);
});

test('a loaded plan is unchanged', () => {
  const plan = {onetimeOptions: [{id: 'a', amountWithoutGst: 999}]};
  expect(calculatePlanPaymentAmount({specificPlan: plan, selectedPlanType: 'onetime', selectedCard: 'onetime-a'})).toBe(999);
});
