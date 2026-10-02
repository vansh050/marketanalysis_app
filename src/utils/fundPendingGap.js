/**
 * FUNDING_PENDING Repair legs (Phase 2, 2026-09-20).
 *
 * A BUY quantity the last frozen plan could not fund even after every sale
 * settles is carried by the backend as an exact Repair leg
 * (`isFundingPending`, `fundingRequired`) instead of being sent back to a
 * whole-basket recalculation. These helpers summarise those legs and build the
 * `fund_pending` capital instruction the customer can record: a top-up whose
 * deployment the backend restricts to the recorded gaps — buy-only, never a
 * full reallocation. Same durable row shape as Modify Investment so capital
 * authorization accounting is unchanged.
 */

export function summarizeFundingPendingLegs(rows, getPrice) {
  const legs = (Array.isArray(rows) ? rows : []).filter(
    row => row?.isFundingPending && String(row?.orderType || '').toUpperCase() === 'BUY',
  );
  const total = legs.reduce((sum, row) => {
    const known = Number(row.fundingRequired);
    if (Number.isFinite(known) && known > 0) return sum + known;
    const px = Number(
      (typeof getPrice === 'function' ? getPrice(row.symbol) : 0) || row.frozenPrice || 0,
    );
    const qty = Number(row.qty ?? row.quantity ?? 0);
    return sum + (Number.isFinite(px) && px > 0 ? qty * px : 0);
  }, 0);
  return {count: legs.length, total: Math.round(total * 100) / 100, legs};
}

export function fundPendingEntry({preview, gapAmount, dateTime}) {
  const gap = Math.ceil(Number(gapAmount) || 0);
  const priorBase = Number(preview?.baseInvestmentAmount);
  if (!Number.isFinite(gap) || gap <= 0) throw new Error('No funding gap to record.');
  if (preview?.status !== 0 || !Number.isFinite(priorBase)) {
    throw new Error('Your current investment amount could not be read. Please try again.');
  }
  const total = Math.round((priorBase + gap) * 100) / 100;
  return {
    investmentIntentVersion: 2, inputMode: 'fund_pending', enteredAmount: gap,
    includePnl: false, pnlQuoteId: null,
    amount: total, baseInvestmentAmount: Math.round(priorBase * 100) / 100, pnlAdjustment: 0,
    changeMode: 'fund_pending', changeAmount: gap, dateTime,
    reason: 'complete_allocation_gap',
  };
}
