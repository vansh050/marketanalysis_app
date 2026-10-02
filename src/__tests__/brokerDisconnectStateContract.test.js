import fs from 'fs';
import path from 'path';

const read = relative =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('server-authoritative broker disconnect contract', () => {
  const subscription = read('src/screens/Home/SubscriptionScreen.js');
  const connections = read('src/screens/Home/ManageConnectionsModal.js');

  test.each([
    ['brokerless disconnect', subscription],
    ['manage connections disconnect', connections],
  ])('%s verifies a refreshed server document before local success', (_name, source) => {
    const removeAt = source.indexOf('await axios.delete(');
    const refreshAt = source.indexOf('disconnectVerification: Date.now()', removeAt);
    const classifyAt = source.indexOf('getServerBrokerReconnectState(', refreshAt);
    const successAt = source.indexOf('disconnected successfully', classifyAt);

    expect(removeAt).toBeGreaterThan(-1);
    expect(refreshAt).toBeGreaterThan(removeAt);
    expect(classifyAt).toBeGreaterThan(refreshAt);
    if (successAt !== -1) expect(successAt).toBeGreaterThan(classifyAt);
    expect(source).toContain('if (reconnectState.hasSlot)');
    expect(source).toContain('removeDeviceTotp(deviceIdentity)');
    expect(source).toContain('removePersistedBrokerCredentials(deviceIdentity)');
  });

  test('brokerless mode no longer continues after a failed slot removal', () => {
    expect(subscription).not.toContain(
      "removeBrokerConnection failed (continuing)",
    );
  });
});
