const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('native modal lifecycle safety', () => {
  test('shared native modal roots stay mounted while their visibility props close them', () => {
    const profile = read('src/components/ProfileModal.js');
    const brokerScreen = read('src/screens/Home/SubscriptionScreen.js');
    const navigation = read('src/components/Navigation.js');

    expect(profile).not.toContain('if (!shouldRender) return null');
    expect(brokerScreen).not.toContain('{showDisconnectBroker && (');
    expect(brokerScreen).not.toContain('{showManageConnections && (');
    expect(navigation).not.toContain('{showMigrationModal && (');

    expect(brokerScreen).toContain('<DisconnectBrokerModal');
    expect(brokerScreen).toContain('<ManageConnectionsModal');
    expect(navigation).toContain('<HoldingsMigrationModal');
  });

  test('bottom tabs do not subscribe to keyboard events when keyboard hiding is disabled', () => {
    const navigation = read('src/components/Navigation.js');
    const patch = read('patches/@react-navigation+bottom-tabs+7.10.1.patch');

    expect(navigation).toContain('tabBarHideOnKeyboard: false');
    expect(navigation).toContain('freezeOnBlur: true');
    expect(patch).toContain(
      'useIsKeyboardShown(tabBarHideOnKeyboard)',
    );
    expect(patch).toContain('if (!enabled)');
  });
});
