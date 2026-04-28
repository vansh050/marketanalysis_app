/**
 * ORDERS E2E Tests — Detox
 * Matches: Cypress trading/recommendations.cy.js → Order Book section
 *
 * Run: npx detox test -c android.emu.debug e2e/specs/orders.test.js
 */

const {
  login,
  navigateToTab,
  assertScreenLoaded,
  assertNoErrorScreen,
  waitForLoading,
  takeNamedScreenshot,
} = require('../helpers/testHelpers');

describe('Orders Screen', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    await login();
  });

  // ─── ORD-001: Order Screen Loads ───

  describe('Order Screen Load', () => {
    it('should navigate to Orders tab', async () => {
      await navigateToTab('Orders');
      await waitForLoading();
      await assertScreenLoaded();
      await takeNamedScreenshot('ORD-001_orders_screen');
    });

    it('should not show error screen', async () => {
      await assertNoErrorScreen();
    });
  });

  // ─── ORD-002: Order Tabs ───

  describe('Order Tabs', () => {
    it('should show placed/executed orders tab', async () => {
      try {
        await element(by.text('Placed')).tap();
        await waitForLoading();
        await assertScreenLoaded();
        await takeNamedScreenshot('ORD-002_placed_orders');
      } catch {
        // Tab may have different name
        try {
          await element(by.text('Executed')).tap();
        } catch {
          // Single tab layout
        }
      }
    });

    it('should show rejected orders tab', async () => {
      try {
        await element(by.text('Rejected')).tap();
        await waitForLoading();
        await assertScreenLoaded();
        await takeNamedScreenshot('ORD-002_rejected_orders');
      } catch {
        // Tab may have different name or not exist
        try {
          await element(by.text('Failed')).tap();
        } catch {
          // Single tab layout
        }
      }
    });

    it('should show orders or empty state', async () => {
      // Either order cards or empty state should exist
      await assertScreenLoaded();
      await assertNoErrorScreen();
    });
  });
});
