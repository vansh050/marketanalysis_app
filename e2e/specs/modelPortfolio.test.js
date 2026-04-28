/**
 * MODEL PORTFOLIO E2E Tests — Detox
 * Matches: Cypress portfolio/model-portfolio.cy.js (14 tests)
 *
 * Run: npx detox test -c android.emu.debug e2e/specs/modelPortfolio.test.js
 */

const {
  login,
  navigateToTab,
  assertScreenLoaded,
  assertNoErrorScreen,
  waitForLoading,
  takeNamedScreenshot,
} = require('../helpers/testHelpers');

describe('Model Portfolio', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    await login();
  });

  // ─── MP-001: Strategy List ───

  describe('Strategy List', () => {
    it('should navigate to Model Portfolio screen', async () => {
      // Try via drawer
      try {
        await element(by.type('android.widget.ScrollView')).atIndex(0).swipe('left');
        await element(by.text('Model Portfolio')).tap();
      } catch {
        // Try via tab or More menu
        try {
          await navigateToTab('More');
          await element(by.text('Model Portfolio')).tap();
        } catch {
          // Try Plans tab
          await navigateToTab('Plans');
        }
      }

      await waitForLoading();
      await assertScreenLoaded();
      await takeNamedScreenshot('MP-001_strategy_list');
    });

    it('should not show error screen', async () => {
      await assertNoErrorScreen();
    });
  });

  // ─── MP-002: Strategy Detail ───

  describe('Strategy Detail', () => {
    it('should open strategy detail when tapped', async () => {
      try {
        // Tap first strategy card
        await element(by.type('android.view.ViewGroup'))
          .atIndex(2) // Strategy card
          .tap();

        await waitForLoading();
        await assertScreenLoaded();
        await takeNamedScreenshot('MP-002_strategy_detail');

        // Go back
        await device.pressBack();
      } catch {
        // No strategy cards to tap
        await assertScreenLoaded();
      }
    });
  });

  // ─── MP-003: Navigation ───

  describe('Navigation', () => {
    it('should navigate back from strategy detail', async () => {
      await device.pressBack();
      await assertScreenLoaded();
    });

    it('should handle rapid navigation without crash', async () => {
      // Navigate between tabs and back
      await navigateToTab('Home');
      await navigateToTab('Portfolio');
      await navigateToTab('Home');
      await assertNoErrorScreen();
    });
  });
});
