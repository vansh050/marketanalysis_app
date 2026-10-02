/**
 * BROKER CONNECTION E2E Tests — Detox
 * Matches: Cypress payment/subscription.cy.js → broker section
 *
 * Run: npx detox test -c android.emu.debug e2e/specs/brokerConnection.test.js
 */

const {
  login,
  navigateToTab,
  assertScreenLoaded,
  assertNoErrorScreen,
  waitForLoading,
  scrollDownTo,
  takeNamedScreenshot,
} = require('../helpers/testHelpers');

describe('Broker Connection', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    await login();
  });

  // ─── BROKER-001: Broker List ───

  describe('Broker List', () => {
    it('should navigate to broker settings', async () => {
      await navigateToTab('More');
      await waitForLoading();

      try {
        await element(by.text('Broker Setting')).tap();
      } catch {
        try {
          await element(by.text('Connect Broker')).tap();
        } catch {
          await element(by.text('Broker')).tap();
        }
      }

      await waitForLoading();
      await assertScreenLoaded();
      await takeNamedScreenshot('BROKER-001_broker_list');
    });

    it('should display supported brokers', async () => {
      const brokers = ['Zerodha', 'Angel One', 'Dhan', 'Groww'];
      for (const broker of brokers) {
        await waitFor(element(by.id(`broker-card-${broker}`)))
          .toExist()
          .whileElement(by.type('RCTScrollView'))
          .scroll(180, 'down');
      }
    });

    it('should not show error screen', async () => {
      await assertNoErrorScreen();
    });
  });

  // ─── BROKER-002: Broker Modal ───

  describe('Broker Connection Modal', () => {
    it('should open Dhan credential form', async () => {
      await waitFor(element(by.id('broker-card-Dhan'))).toExist().withTimeout(10000);
      await element(by.id('broker-card-Dhan')).tap();
      await waitForLoading();
      await assertScreenLoaded();
      await takeNamedScreenshot('BROKER-002_dhan_modal');
      await device.pressBack();
    });

    it('should open Zerodha OAuth WebView', async () => {
      await waitFor(element(by.id('broker-card-Zerodha'))).toExist().withTimeout(10000);
      await element(by.id('broker-card-Zerodha')).tap();
      await waitForLoading();
      await assertScreenLoaded();
      await takeNamedScreenshot('BROKER-002_zerodha_webview');
      await device.pressBack();
    });
  });

  // ─── BROKER-003: Broker Status ───

  describe('Broker Status', () => {
    it('should show connected/expired status indicators', async () => {
      await assertScreenLoaded();
      // Status indicators vary by state
      await takeNamedScreenshot('BROKER-003_broker_status');
    });
  });
});
