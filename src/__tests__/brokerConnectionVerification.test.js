jest.mock('../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'test-token'),
}));

jest.mock('react-native-config', () => ({
  REACT_APP_HEADER_NAME: 'prod',
  REACT_APP_AQ_KEYS: 'k',
  REACT_APP_AQ_SECRET: 's',
}));

jest.mock('../utils/variantHelper', () => ({
  getTenantSubdomain: configData =>
    configData?.config?.REACT_APP_HEADER_NAME ||
    configData?.REACT_APP_HEADER_NAME ||
    'prod',
}));

import {
  brokerNamesMatch,
  persistedBrokerMatches,
  resolveAdvisorSubdomain,
} from '../utils/brokerConnectionVerification';

describe('broker connection persistence verification', () => {
  test('requires the selected broker to be canonical and connected', () => {
    expect(
      persistedBrokerMatches(
        {
          user_broker: 'Zerodha',
          connect_broker_status: 'connected',
          noBrokerRequired: false,
        },
        'Zerodha',
      ),
    ).toBe(true);
    expect(
      persistedBrokerMatches(
        {user_broker: 'Groww', connect_broker_status: 'connected'},
        'Zerodha',
      ),
    ).toBe(false);
  });

  test('accepts a live connection even when the brokerless preference lingers', () => {
    // Regression: noBrokerRequired is a PREFERENCE, not connection state. A
    // real account (2026-09-17) had a fully connected, unexpired Zerodha
    // session AND noBrokerRequired:true, and the gate blocked the very user it
    // was built for. The backend clears the flag on connect; verification must
    // not treat it as evidence of a failed save.
    expect(
      persistedBrokerMatches(
        {
          user_broker: 'Zerodha',
          primary_broker: 'Zerodha',
          connect_broker_status: 'connected',
          noBrokerRequired: true,
          connected_brokers: [{broker: 'Zerodha', status: 'connected'}],
        },
        'Zerodha',
      ),
    ).toBe(true);
  });

  test('requires the selected multi-broker slot when that schema exists', () => {
    expect(
      persistedBrokerMatches(
        {
          primary_broker: 'Zerodha',
          user_broker: 'Zerodha',
          connect_broker_status: 'connected',
          connected_brokers: [{broker: 'Zerodha', status: 'expired'}],
        },
        'Zerodha',
      ),
    ).toBe(false);
  });

  test('normalises broker spelling aliases', () => {
    expect(brokerNamesMatch('Hdfc Securities', 'HDFC Securities')).toBe(true);
    expect(brokerNamesMatch('AngelOne', 'Angel One')).toBe(true);
  });
});

describe('shared dispatcher persistence-gate ordering contract', () => {
  const fs = require('fs');
  const path = require('path');
  const read = rel => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  test('host refresh runs before verification so the legacy lane is never stranded', () => {
    const src = read('src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js');
    const refreshAt = src.indexOf('const result = await fetchBrokerStatusModal?.(...args)');
    const verifyAt = src.indexOf('verifiedUser = await verifyPersistedBrokerConnection(');
    expect(refreshAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeGreaterThan(-1);
    // Legacy modals dismiss before calling us and swallow the throw, so
    // verifying first would skip their TradeContext refresh entirely.
    expect(refreshAt).toBeLessThan(verifyAt);
  });

  test('reconciliation is suppressed only by a contradiction, not by an unreadable record', () => {
    const src = read('src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js');
    const guardAt = src.indexOf('if (!verificationError) {');
    const enqueueAt = src.indexOf('startAccountReconciliation(');
    expect(guardAt).toBeGreaterThan(-1);
    expect(enqueueAt).toBeGreaterThan(guardAt);
    // `if (verifiedUser)` would skip reconciliation whenever the record simply
    // could not be read, which is a regression against pre-gate behaviour.
    expect(src).not.toContain('if (verifiedUser) {');
  });

  test('a failed verification still propagates to the caller', () => {
    const src = read('src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js');
    expect(src).toContain('if (verificationError) {');
    expect(src).toContain('throw verificationError;');
  });

  test('AliceBlue waits for SDK persistence and refreshes before publishing success', () => {
    const src = read('src/components/BrokerConnectionModal/AliceBlueConnect.js');
    const sdkWriteAt = src.indexOf('await sdkDualWriteSafely(');
    const refreshAt = src.indexOf('const result = await fetchBrokerStatusModal?.()');
    const emitAt = src.indexOf("eventEmitter.emit('refreshEvent'", refreshAt);
    expect(sdkWriteAt).toBeGreaterThan(-1);
    expect(refreshAt).toBeGreaterThan(sdkWriteAt);
    expect(emitAt).toBeGreaterThan(refreshAt);
    expect(src).toContain('fundsAlreadyRefreshed: true');
  });

  test('AliceBlue verifies the refreshed session and dismisses every stale auth prompt', () => {
    const alice = read('src/components/BrokerConnectionModal/AliceBlueConnect.js');
    const picker = read('src/components/BrokerSelectionModal.js');
    expect(alice).toContain('classifyFundsResponse(');
    expect(alice).toContain("sessionCheck.reason === 'TOKEN_EXPIRED'");
    expect(alice).toContain("eventEmitter.emit('brokerConnectionVerified'");
    expect(picker).toContain("eventEmitter.on('brokerConnectionVerified'");
    expect(picker).toContain('setOpenTokenExpireModel(false)');
  });

  test('the SDK lane announces success and refreshes the app before dismissing', () => {
    // It used to close silently: the customer landed on Home with no idea
    // whether the broker had connected (2026-09-17). Legacy modals both
    // toast and emit refreshEvent; the SDK lane now matches them.
    const src = read('src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js');
    const onSuccessAt = src.indexOf('const onSuccess = async () => {');
    const body = src.slice(onSuccessAt, onSuccessAt + 2600);
    const emitAt = body.indexOf("eventEmitter.emit('refreshEvent'");
    const toastAt = body.indexOf('text1: `${brokerName} connected`');
    const dismissAt = body.indexOf('setShowBrokerModal?.(false)');
    expect(emitAt).toBeGreaterThan(-1);
    expect(toastAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeGreaterThan(toastAt);
    // still skipped when the migration sheet will be the success surface
    expect(body).toContain('if (!result?.migrationWillShow)');
  });

  test('the SDK lane returns before dismissing when verification fails', () => {
    const src = read('src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js');
    const onSuccessAt = src.indexOf('const onSuccess = async () => {');
    const body = src.slice(onSuccessAt, onSuccessAt + 2600);
    const catchReturnAt = body.indexOf("technical: error?.code || 'BROKER_PERSISTENCE_NOT_VERIFIED'");
    const dismissAt = body.indexOf('setShowBrokerModal?.(false)');
    expect(catchReturnAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeGreaterThan(catchReturnAt);
    expect(body.slice(catchReturnAt, dismissAt)).toContain('return;');
  });

  test('Kotak success closes through the common callback used by ModalManager', () => {
    // Rebalance opens Kotak through the app-root ModalManager, which supplies
    // `onClose` but no legacy `setShowKotakModal` prop. The old unconditional
    // setter threw immediately after a successful connect and broke this flow.
    const src = read('src/components/BrokerConnectionModal/KotakModal.js');
    const successAt = src.indexOf("console.log('[Kotak Neo] Model portfolio updated successfully')");
    const body = src.slice(successAt, successAt + 1800);
    const commonCloseAt = body.indexOf("typeof onClose === 'function'");
    const legacyCloseAt = body.indexOf("typeof setShowKotakModal === 'function'");
    expect(commonCloseAt).toBeGreaterThan(-1);
    expect(legacyCloseAt).toBeGreaterThan(commonCloseAt);
    expect(body).not.toContain('setShowKotakModal(false);\n        setShowBrokerModal(false);');
  });
});

describe('tenant header resolution (2026-09-17 regression)', () => {
  test('never falls back to the build-variant name while .env has the tenant key', () => {
    // getAdvisorSubdomain() returns the BUILD VARIANT ("alphaquark"), not the
    // tenant key ("prod"). Passing the theming config (which carries neither)
    // must still resolve to the tenant every other request uses, or the read
    // lands in the wrong tenant and looks exactly like a failed save.
    expect(resolveAdvisorSubdomain({themeColor: '#fff'})).toBe('prod');
    expect(resolveAdvisorSubdomain(undefined)).toBe('prod');
    expect(resolveAdvisorSubdomain(null)).not.toBe('alphaquark');
  });

  test('prefers an explicitly supplied TradeContext config over env', () => {
    expect(
      resolveAdvisorSubdomain({config: {REACT_APP_HEADER_NAME: 'markup'}}),
    ).toBe('markup');
    expect(resolveAdvisorSubdomain({REACT_APP_HEADER_NAME: 'rgx'})).toBe('rgx');
  });
});

describe('fail-open when the account cannot be read', () => {
  const load = () => require('../utils/brokerConnectionVerification');

  beforeEach(() => jest.resetModules());

  test('a read failure resolves null instead of blocking the connect', async () => {
    jest.doMock('axios', () => ({
      get: jest.fn(() => Promise.reject(new Error('Network Error'))),
    }));
    const {verifyPersistedBrokerConnection} = load();
    await expect(
      verifyPersistedBrokerConnection({
        broker: 'Zerodha',
        userEmail: 'a@b.com',
        attempts: 1,
      }),
    ).resolves.toBeNull();
  });

  test('a missing user record resolves null rather than claiming a bad save', async () => {
    jest.doMock('axios', () => ({get: jest.fn(async () => ({data: {}}))}));
    const {verifyPersistedBrokerConnection} = load();
    await expect(
      verifyPersistedBrokerConnection({
        broker: 'Zerodha',
        userEmail: 'a@b.com',
        attempts: 1,
      }),
    ).resolves.toBeNull();
  });

  test('a record that CONTRADICTS the connect still hard-blocks', async () => {
    jest.doMock('axios', () => ({
      get: jest.fn(async () => ({
        data: {User: {user_broker: 'Groww', connect_broker_status: 'connected'}},
      })),
    }));
    const {verifyPersistedBrokerConnection} = load();
    await expect(
      verifyPersistedBrokerConnection({
        broker: 'Zerodha',
        userEmail: 'a@b.com',
        attempts: 1,
      }),
    ).rejects.toMatchObject({code: 'BROKER_PERSISTENCE_NOT_VERIFIED'});
  });
});
