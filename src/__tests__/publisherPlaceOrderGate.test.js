/**
 * Publisher Place Order gate (prod/arulthakur, 2026-09-17).
 *
 * The Kite run returns before record-back and the order-book check finish.
 * Re-showing a placeable review in that window reads as "nothing happened,
 * place them again" while the orders are already sitting with the broker —
 * arul's second launch minted seven orphan `traderecos` rows that no
 * reconciler owns, and the Orders screen renders them as "Unknown".
 *
 * Alphab2bapp 87f7a8c added the gate to RebalanceModal only. These tests pin
 * it in all three publisher modals so a fourth (or a refactor) cannot drop it
 * silently. Record:
 * prod-alphaquark-github/docs/server_issues/2026-09-17-arul-zerodha-orders-unknown-orphan-rows.md
 */

const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

// Each modal names its WebView state differently, so the derivation differs.
const modals = {
  'AdviceScreenComponents/RebalanceModal.js': 'webView',
  'ModelPortfolioComponents/MPReviewTradeModal.js': 'isWebView',
  'ModelPortfolioComponents/UserStrategySubscribeModal.js': 'isWebView',
};

const modalPath = name => `src/components/${name}`;

describe('publisher Place Order gate', () => {
  test.each(Object.entries(modals))(
    '%s derives awaitingOrderStatus from the post-submission window',
    (name, webViewState) => {
      const source = read(modalPath(name));
      expect(source).toContain(
        `const awaitingOrderStatus = zerodhaStatus === 'success' && !${webViewState};`,
      );
    },
  );

  test.each(Object.keys(modals))(
    '%s disables the place-order control while awaiting order status',
    name => {
      const source = read(modalPath(name));
      expect(source).toMatch(/disabled=\{[^}]*awaitingOrderStatus[^}]*\}/);
    },
  );

  test.each(Object.keys(modals))(
    '%s explains the wait instead of re-offering Place Order',
    name => {
      const source = read(modalPath(name));
      expect(source).toContain('Checking your order status');
    },
  );

  test.each(Object.keys(modals))(
    '%s clears the gate state so it cannot latch on',
    name => {
      const source = read(modalPath(name));
      expect(source).toContain('setZerodhaStatus(null)');
    },
  );
});
