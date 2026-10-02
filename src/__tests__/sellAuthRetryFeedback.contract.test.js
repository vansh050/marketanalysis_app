/**
 * Sell-authorization retry + order-placement feedback (2026-10-01 reports):
 *
 * 1. "I've authorized — recalculate" closed the sheet BEFORE the network
 *    work: the customer sat on the home screen, then the review reappeared
 *    with no explanation; failures were silent.
 * 2. Fyers "Place Order" did nothing visible: the SDK refused (sell-auth
 *    pre-check) and the "Order Failed" toast rendered underneath the native
 *    Modal (the only <Toast /> host lived in App.js).
 * 3. The sell-auth sheet's checkbox label and side-by-side buttons clipped
 *    on ~360dp phones.
 */
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
const ddpi = read('src/components/DdpiModal.js');
const rebalance = read('src/components/AdviceScreenComponents/RebalanceModal.js');

const handler = ddpi.slice(
  ddpi.indexOf('const handleAcceptRebalance = async () => {'),
  ddpi.indexOf('const toggleCheckbox = () => {'),
);

describe('sell-authorization retry keeps the customer informed', () => {
  test('the sheet stays open until the recalculation succeeds', () => {
    const calc = handler.indexOf('rebalance/calculate');
    const close = handler.indexOf('onContinue();');
    expect(calc).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(calc);
    expect(handler).toContain("setRetryStage('saving')");
    expect(handler).toContain("setRetryStage('recalculating')");
    expect(handler).toContain('if (retryStage) return;');
  });

  test('success says no orders were placed; failure stays on the sheet', () => {
    expect(handler).toContain(
      'No orders placed yet. Review the updated orders and tap Place Order.',
    );
    expect(handler).toContain('setRetryError(');
    expect(handler).toContain('No orders were placed. Tap retry.');
    expect(ddpi).toContain("'Saving your authorization…'");
    expect(ddpi).toContain("'Recalculating your orders…'");
  });

  test('an authorization save failure does not block the recalculation', () => {
    // Money-path guard rule: block only on positive evidence.
    expect(handler).toContain('authorizationSaved = false;');
    expect(handler.indexOf('authorizationSaved = false;')).toBeLessThan(
      handler.indexOf("setRetryStage('recalculating')"),
    );
  });

  test('the review screen explains a post-authorization recalculation', () => {
    expect(rebalance).toContain('testID="sell-auth-retry-note"');
    expect(rebalance).toContain('_sellAuthorizationRetry === true');
  });
});

describe('toasts are visible over native modals', () => {
  test('RebalanceModal and every sell-auth modal host their own <Toast />', () => {
    expect(rebalance).toMatch(/<Toast \/>\s*<\/Modal>\s*\);\s*};\s*$/m);
    for (const name of [
      'OtherBrokerModel',
      'AngleOneTpinModal',
      'DhanTpinModal',
      'FyersTpinModal',
    ]) {
      const start = ddpi.indexOf(`export function ${name}`);
      const next = ddpi.indexOf('\nexport ', start + 10);
      const body = ddpi.slice(start, next === -1 ? undefined : next);
      expect({name, hasHost: body.includes('<Toast />')}).toEqual({
        name,
        hasHost: true,
      });
    }
  });
});

describe('Fyers SDK sell-auth refusal opens the TPIN flow', () => {
  test('sell_auth_declined routes to the Fyers TPIN modal with an explanation', () => {
    const at = rebalance.indexOf("error?.code === 'sell_auth_declined'");
    expect(at).toBeGreaterThan(-1);
    const block = rebalance.slice(at, at + 600);
    expect(block).toContain('setShowFyersTpinModal(true)');
    expect(block).toContain('No orders were placed.');
  });
});

describe('sell-auth sheet fits narrow phones', () => {
  test('checkbox label wraps and actions stack full-width', () => {
    expect(ddpi).toMatch(/label: \{[^}]*flexShrink: 1/);
    expect(ddpi).toMatch(/actionsContainer: \{[^}]*flexDirection: 'column'/);
    expect(ddpi).toContain('otherBrokerStyles.fullWidthAction');
  });
});
