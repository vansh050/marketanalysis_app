/**
 * Reconnect changes nothing on the account until the login succeeds
 * (Kyzen QA 2026-10-14). Tapping Reconnect used to switch primary_broker and
 * mark the broker expired up-front, so an abandoned login left an expired
 * broker as primary and labelled a live Fyers session "Session Expired".
 */
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('reconnect has no account side effects before login succeeds', () => {
  const manage = read('screens/Home/ManageConnectionsModal.js');
  const reconnect = manage.slice(
    manage.indexOf('const handleReconnect = async'),
    manage.indexOf('const renderConnection'),
  );

  test('ManageConnections reconnect does not mark the broker expired', () => {
    expect(reconnect).not.toContain('markBrokerExpired(');
  });

  test('primary switches only in the confirmed-live (silent) branch, after smart reauth', () => {
    const smart = reconnect.indexOf('await handleSmartReauth(');
    const flip = reconnect.indexOf('await flipPrimaryBroker(');
    expect(smart).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(smart);
    const silentBranch = reconnect.slice(reconnect.indexOf('if (result.handled && result.silent)'));
    expect(silentBranch.indexOf('await flipPrimaryBroker(')).toBeLessThan(silentBranch.indexOf('if (result.handled) {'));
  });

  test('BrokerSelectionModal login does not switch primary before the login', () => {
    const selection = read('components/BrokerSelectionModal.js');
    expect(selection).not.toContain('flipPrimaryBroker(');
  });
});
