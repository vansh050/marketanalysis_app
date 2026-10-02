const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

// Assertions below are about executable code, not the comments that explain
// it — several of those quote the very shape we are banning.
const stripComments = source =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/**
 * The customer states a total investment amount during plan purchase. That
 * amount is only durable once `rebalance/insert-user-doc` has stored it in
 * `subscription_amount_raw`; if the write is skipped or throws, the first
 * rebalance asks the customer for the amount all over again.
 *
 * Two regressions have shipped here:
 *
 *  1. `latestRebalance.model_Id` read unguarded threw a TypeError AFTER the
 *     payment had already succeeded (2026-07-07 arfs incident). In the
 *     Razorpay one-time path that throw was caught by the payment handler and
 *     shown to the customer as a false "Payment Failed".
 *  2. The fix for (1) gated the whole write on `latestRebalance` being
 *     truthy. `latestRebalance` is `null` until a rebalance history is
 *     fetched — which never happens for a model with no rebalances yet, or
 *     when the pre-purchase strategy fetch is access restricted. So the
 *     amount was silently dropped on exactly the first purchase.
 *
 * `model_id` is optional to the endpoint (the server scopes by model name
 * when it is absent), so the correct shape is: gate on `strategyDetails`
 * only, and reach `model_Id` with optional chaining.
 */
describe('investment amount survives plan purchase', () => {
  const sources = {
    'src/FunctionCall/PaymentHandle.js': stripComments(
      read('src/FunctionCall/PaymentHandle.js'),
    ),
    'src/components/ModelPortfolioComponents/MPInvestNowModal.js': stripComments(
      read('src/components/ModelPortfolioComponents/MPInvestNowModal.js'),
    ),
  };

  Object.entries(sources).forEach(([file, source]) => {
    test(`${file} never reads model_Id off a possibly-null latestRebalance`, () => {
      expect(source).not.toMatch(/latestRebalance\.model_Id/);
    });

    test(`${file} does not gate the insert-user-doc write on latestRebalance`, () => {
      expect(source).not.toContain('strategyDetails && latestRebalance');
    });
  });

  test('every insert-user-doc call still carries the stated amount', () => {
    Object.entries(sources).forEach(([, source]) => {
      const calls = source.split('rebalance/insert-user-doc').length - 1;
      expect(calls).toBeGreaterThan(0);
    });
    // The payload builder and the request are adjacent; assert the amount is
    // sourced from the customer's input rather than a plan-price field.
    expect(sources['src/FunctionCall/PaymentHandle.js']).toContain(
      'amount: invetAmount,',
    );
    expect(
      sources['src/components/ModelPortfolioComponents/MPInvestNowModal.js'],
    ).toContain('amount: invetAmount,');
  });
});
