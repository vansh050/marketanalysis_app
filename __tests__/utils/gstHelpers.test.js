import {
  gstLabel,
  recBase,
  recDisplay,
  recPayment,
} from '../../src/utils/gstHelpers';

describe('recurring GST pricing', () => {
  const currentPlan = {
    pricingWithoutGst: {yearly: 10000},
    pricing: {yearly: 11800},
  };
  const legacyPlan = {pricing: {yearly: 11800}};

  it('uses the explicit pre-GST amount for the detail-page label', () => {
    expect(recBase(currentPlan, 'yearly', true)).toBe(10000);
    expect(recDisplay(currentPlan, 'yearly', true, false)).toBe(10000);
    expect(gstLabel(true, false)).toBe(' + GST');
  });

  it('derives the base from a legacy GST-inclusive stored total', () => {
    expect(recBase(legacyPlan, 'yearly', true)).toBe(10000);
    expect(recDisplay(legacyPlan, 'yearly', true, false)).toBe(10000);
  });

  it('keeps inclusive display and gateway totals at ₹11,800', () => {
    expect(recDisplay(currentPlan, 'yearly', true, true)).toBe(11800);
    expect(recPayment(currentPlan, 'yearly', true)).toBe(11800);
    expect(recPayment(legacyPlan, 'yearly', true)).toBe(11800);
  });

  it('does not remove GST when the advisor has GST disabled', () => {
    expect(recBase(legacyPlan, 'yearly', false)).toBe(11800);
  });
});
