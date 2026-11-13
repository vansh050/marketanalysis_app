/**
 * Unbought model stocks on an empty rebalance plan (2026-11-13).
 *
 * Calculate returns `unfilledModelLegs` when the customer holds none of some
 * model stocks and the plan buys none of them (ccxt `unfilled_legs.py`). Such a
 * plan is empty because nothing needs selling and no money is authorised for
 * the missing stocks — it is not "Already Aligned" (markup/siddhartha: 10 of
 * 25 names unheld, ₹17L idle at the broker, app said "Already Aligned").
 * Completing the model needs an add-funds (`fund_pending`) instruction.
 */

export function summarizeUnfilledModelLegs(calculation) {
  const legs = calculation && typeof calculation === 'object'
    ? calculation.unfilledModelLegs
    : null;
  const symbols = Array.isArray(legs?.symbols) ? legs.symbols.filter(Boolean) : [];
  if (symbols.length === 0) return null;
  const amount = value => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    symbols,
    names: symbols.map(sym => String(sym).replace(/-EQ$/, '')),
    requiredAmount: amount(legs.requiredAmount),
    suggestedAmount: amount(legs.suggestedAmount),
    availableCash: amount(legs.availableCash),
  };
}

export function formatRupees(value) {
  return Number(value || 0).toLocaleString('en-IN', {maximumFractionDigits: 0});
}
