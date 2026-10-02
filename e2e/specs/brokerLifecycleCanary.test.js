/**
 * Opt-in real-device mixed-session canary.
 *
 * Preconditions:
 * - a staging account with two independently authenticated brokers
 * - BROKER_DEVICE_CANARY=1 and the expected broker/status environment values
 * - no production credentials committed to this repository
 */
const {login, navigateToTab, waitForLoading} = require('../helpers/testHelpers');

const enabled = process.env.BROKER_DEVICE_CANARY === '1';
const describeCanary = enabled ? describe : describe.skip;
const primary = process.env.BROKER_CANARY_PRIMARY || 'DefinEdge Securities';
const secondary = process.env.BROKER_CANARY_SECONDARY || 'Zerodha';
const primaryStatus = process.env.BROKER_CANARY_PRIMARY_STATUS || 'connected';
const secondaryStatus = process.env.BROKER_CANARY_SECONDARY_STATUS || 'expired';

describeCanary('real-device cross-broker lifecycle canary', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    await login();
    await navigateToTab('More');
    await waitForLoading();
    await waitFor(element(by.text('Broker Account'))).toBeVisible().withTimeout(15000);
    await element(by.text('Broker Account')).tap();
    await waitForLoading();
  });

  it('renders both independent broker sessions with their expected states', async () => {
    await waitFor(element(by.id(`broker-card-${primary}`))).toExist().withTimeout(15000);
    await waitFor(element(by.id(`broker-card-${secondary}`))).toExist().withTimeout(15000);
    await expect(element(by.id(`broker-status-${primary}`))).toHaveLabel(
      `${primary} broker ${primaryStatus}`,
    );
    await expect(element(by.id(`broker-status-${secondary}`))).toHaveLabel(
      `${secondary} broker ${secondaryStatus}`,
    );
  });
});
