/**
 * 2026-09-23 — every Kite BUY basket is sized against live buying power.
 *
 * moneyman/share2anand (MFCC): the refit was wired only inside the sell-gate
 * branches, so it never ran when the gate was happy and never at all for a
 * buy-only Repair basket (no sells for the gate to wait on). His Repair went
 * to Kite at the frozen 8489 and Zerodha rejected the whole ₹9.95L order for a
 * ₹1,629 shortfall. The same customer's web attempt an hour earlier refitted
 * to 8475 and would have filled.
 *
 * Source-level because the modal is not unit-mountable here; these pin the
 * wiring the incident turned on, not the refit's own arithmetic.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

const submitKiteBatch = (() => {
  const start = SOURCE.indexOf('const submitKiteBatch = async (index,');
  const end = SOURCE.indexOf('const finishKitePublisherRun', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
})();

describe('every BUY basket is refitted before Kite opens', () => {
  test('submitKiteBatch refits when the batch carries a BUY leg', () => {
    expect(submitKiteBatch).toContain('hasBuyLeg');
    expect(submitKiteBatch).toContain('refitPendingBatchRef.current?.(');
    const guard = submitKiteBatch.indexOf('refitPendingBatchRef.current?.(');
    const open = submitKiteBatch.indexOf('fetchFreshKiteProtectionPrices');
    expect(open).toBeLessThan(guard); // authoritative prices exist before sizing
  });

  test('a held refit never opens Kite', () => {
    expect(submitKiteBatch).toContain('if (affordable === false)');
    const held = submitKiteBatch.indexOf('if (affordable === false)');
    expect(submitKiteBatch.slice(held, held + 260)).toContain('finishKitePublisherRun()');
    expect(submitKiteBatch.slice(held, held + 260)).toContain('return false;');
  });

  test('a sell-only batch is never sent to the refit', () => {
    expect(submitKiteBatch).toMatch(/hasBuyLeg\s*&&\s*!refittedKiteBatchesRef\.current\.has\(index\)/);
  });

  test('the batch is re-read after the refit replaces it', () => {
    const refitAt = submitKiteBatch.indexOf('refitPendingBatchRef.current?.(');
    const reread = submitKiteBatch.indexOf('const batch = pendingKiteBatchesRef.current[index];', refitAt);
    expect(reread).toBeGreaterThan(refitAt);
  });

  test('a basket the customer can no longer afford closes the run instead of opening an empty Kite window', () => {
    expect(submitKiteBatch).toContain('Nothing left to buy');
  });

  test('refitting is idempotent per batch index', () => {
    expect(submitKiteBatch).toContain('refittedKiteBatchesRef.current.add(index)');
    // the two pre-existing sell-gate callers must therefore become no-ops
    expect(SOURCE).toContain('refitPendingBatchRef.current?.(next)');
  });

  test('the ledger is cleared with every queue rebuild, so a fresh run re-verifies', () => {
    const clears = SOURCE.match(/refittedKiteBatchesRef\.current = new Set\(\)/g) || [];
    expect(clears).toHaveLength(3); // reset + MP two-phase build + advice build
  });

  test('the sell-gate callers are still present (this widens coverage, it does not replace them)', () => {
    expect(SOURCE).toContain("gateResult.status === 'sells-partial-terminal'");
    expect(SOURCE).toContain('settlementRiskAcceptedRef.current = true');
  });

  test('a continuation is consumed only after Kite actually opens', () => {
    const resumeStart = SOURCE.indexOf('const resumeZerodhaBuyPublisher');
    const resumeEnd = SOURCE.indexOf('// "Continue with N Buy"', resumeStart);
    const resume = SOURCE.slice(resumeStart, resumeEnd);
    expect(resume).toContain('const opened = await submitKiteBatch(0, {finishOnHold: false})');
    expect(resume).toMatch(/if \(opened\) \{[\s\S]*onPublisherContinuationConsumed\?\.\(\)/);
  });
});
