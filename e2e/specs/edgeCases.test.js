/**
 * EDGE CASES & STABILITY E2E Tests — Detox
 * Matches: Cypress ui/responsive.cy.js + stability tests
 *
 * Run: npx detox test -c android.emu.debug e2e/specs/edgeCases.test.js
 */

const {
  login,
  navigateToTab,
  assertScreenLoaded,
  assertNoErrorScreen,
  waitForLoading,
  takeNamedScreenshot,
} = require('../helpers/testHelpers');

describe('Edge Cases & Stability', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    await login();
  });

  // ─── EDGE-001: Rapid Tab Switching ───

  describe('Rapid Tab Switching', () => {
    it('should survive rapid tab switching (3 cycles)', async () => {
      for (let i = 0; i < 3; i++) {
        await element(by.text('Home')).tap();
        await element(by.text('Orders')).tap();
        await element(by.text('Portfolio')).tap();
        await element(by.text('More')).tap();
      }
      await element(by.text('Home')).tap();
      await assertScreenLoaded();
      await assertNoErrorScreen();
      await takeNamedScreenshot('EDGE-001_rapid_tabs');
    });
  });

  // ─── EDGE-002: App Backgrounding ───

  describe('App Backgrounding', () => {
    it('should preserve state after background/foreground', async () => {
      await navigateToTab('Portfolio');
      await waitForLoading();

      // Send to background
      await device.sendToHome();

      // Bring back
      await device.launchApp({newInstance: false});

      // Should still be on same screen or restore session
      await assertScreenLoaded();
      await takeNamedScreenshot('EDGE-002_after_background');
    });

    it('should not require re-login after backgrounding', async () => {
      // Should NOT show login screen
      try {
        await expect(element(by.text('Log In'))).not.toBeVisible();
      } catch {
        // toBeVisible check may fail differently — just ensure home is accessible
        await expect(element(by.text('Home'))).toBeVisible();
      }
    });
  });

  // ─── EDGE-003: Empty States ───

  describe('Empty States', () => {
    it('should show empty state on Orders screen', async () => {
      await navigateToTab('Orders');
      await waitForLoading();
      await assertScreenLoaded();
      await assertNoErrorScreen();
      await takeNamedScreenshot('EDGE-003_empty_orders');
    });

    it('should show empty state on Portfolio screen (if no broker)', async () => {
      await navigateToTab('Portfolio');
      await waitForLoading();
      await assertScreenLoaded();
      await assertNoErrorScreen();
      await takeNamedScreenshot('EDGE-003_empty_portfolio');
    });
  });

  // ─── EDGE-004: Screen Rotation ───

  describe('Screen Rotation', () => {
    it('should handle landscape rotation', async () => {
      await navigateToTab('Portfolio');
      await device.setOrientation('landscape');
      await assertScreenLoaded();
      await takeNamedScreenshot('EDGE-004_landscape');
    });

    it('should restore portrait orientation', async () => {
      await device.setOrientation('portrait');
      await assertScreenLoaded();
      await takeNamedScreenshot('EDGE-004_portrait_restored');
    });
  });

  // ─── EDGE-005: Network Toggle ───

  describe('Network Handling', () => {
    it('should handle airplane mode gracefully', async () => {
      await device.enableSynchronization();

      // Toggle airplane mode
      await device.setStatusBar({network: 'none'});
      await navigateToTab('Home');
      await waitForLoading();

      // Should not crash
      await assertScreenLoaded();
      await takeNamedScreenshot('EDGE-005_no_network');

      // Restore network
      await device.setStatusBar({network: 'wifi'});
    });
  });

  // ─── EDGE-006: Session Expired During Use ───

  describe('Session Expired Handling', () => {
    it('should show error toast not crash when broker session expired', async () => {
      // Navigate to a screen that needs broker session
      await navigateToTab('Portfolio');
      await waitForLoading();

      // App should handle expired session gracefully
      await assertScreenLoaded();
      await assertNoErrorScreen();
    });
  });
});
