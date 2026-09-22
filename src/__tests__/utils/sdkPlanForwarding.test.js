import fs from 'fs';
import path from 'path';

/**
 * 2026-09-22 (markup / DefinEdge / "MQ - MultiAsset Dynamic"): a Repair
 * placement was refused `409 PLAN_REQUIRED` with nothing dispatched, twice on
 * 21 Sep and again on 22 Sep. The SDK `executeAdvice` call omitted the plan
 * fields that the legacy axios path forwards, so ccxt saw no `plan_id` and
 * fell back to `resolve_correlated_rebalance_plan` — which excludes
 * `kind: "repair"` on purpose. Every SDK execution path must name its plan.
 */
const source = fs.readFileSync(
  path.resolve(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

describe('SDK executeAdvice forwards the reviewed frozen plan', () => {
  const calls = source.split('executeAdvice(').slice(1);

  test('every mpRebalance executeAdvice call passes planId', () => {
    const mpCalls = calls.filter(c => c.slice(0, 400).includes("kind: 'mpRebalance'"));
    expect(mpCalls.length).toBeGreaterThan(0);
    mpCalls.forEach(call => {
      const head = call.slice(0, 2000);
      expect(head).toMatch(/planId: (payload|additionalPayload)\.plan_id/);
    });
  });

  test('the plan version rides with the plan id', () => {
    expect(source).toMatch(/planVersion: (payload|additionalPayload)\.plan_version/);
  });

  test('forwarding is conditional so a no-freeze advisor is unchanged', () => {
    expect(source).toMatch(/\.\.\.\((payload|additionalPayload)\.plan_id\s*\n?\s*\?/);
  });
});
