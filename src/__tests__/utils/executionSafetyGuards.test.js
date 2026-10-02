jest.mock('@revopush/react-native-code-push', () => ({
  InstallMode: {ON_NEXT_RESTART: 'ON_NEXT_RESTART'},
  sync: jest.fn(() => Promise.resolve()),
  checkForUpdate: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('react-native-device-info', () => ({getVersion: () => '3.9.162'}));
jest.mock('react-native-toast-message', () => ({show: jest.fn()}));
jest.mock('../../utils/Logging', () => ({logZerodhaDiagnostic: jest.fn()}));

import codePush from '@revopush/react-native-code-push';
import Toast from 'react-native-toast-message';
import {
  EXECUTION_BUNDLE_VERSION,
  executionBundleHeaders,
  handleStaleExecutionBundle,
} from '../../utils/executionBundleSafety';
import {isKiteUrl} from '../../hooks/useKiteHandoffGuard';
import {accountRecoveryMetadata} from '../../utils/accountRecoveryUx';

const STALE = {response: {data: {code: 'EXECUTION_BUNDLE_STALE'}}};

describe('execution safety guards', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks execution intents with a monotonic mobile bundle', () => {
    expect(EXECUTION_BUNDLE_VERSION).toBe(2026091102);
    expect(executionBundleHeaders()).toEqual({
      'X-AQ-Execution-Client': 'mobile',
      'X-AQ-Execution-Bundle': '2026091102',
    });
  });

  test('ignores anything but the typed stale-bundle response', async () => {
    expect(await handleStaleExecutionBundle(new Error('network'))).toBe(false);
    expect(codePush.checkForUpdate).not.toHaveBeenCalled();
    expect(codePush.sync).not.toHaveBeenCalled();
  });

  test('stale bundle installs only an exact-target OTA for the next restart', async () => {
    const install = jest.fn(() => Promise.resolve());
    const download = jest.fn(() => Promise.resolve({install}));
    codePush.checkForUpdate.mockResolvedValueOnce({
      appVersion: '3.9.162',
      label: 'v98',
      // 3.9.171+: Revopush echoes the caller's version for open-ended
      // releases, so only a release stamped with the exact marker counts.
      description: '[aq-target ios 3.9.162] [aq-target android 3.9.162]',
      download,
    });

    expect(await handleStaleExecutionBundle(STALE)).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith('ON_NEXT_RESTART');
    expect(codePush.sync).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({text1: 'Safety update downloaded'}),
    );
  });

  test('stale bundle never installs an open-ended OTA (Production v93 >=3.9.129)', async () => {
    const download = jest.fn();
    codePush.checkForUpdate.mockResolvedValueOnce({
      appVersion: '>=3.9.129',
      label: 'v93',
      download,
    });

    expect(await handleStaleExecutionBundle(STALE)).toBe(true);
    expect(download).not.toHaveBeenCalled();
    expect(codePush.sync).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({text1: 'App update required'}),
    );
  });

  test('stale bundle with no update or a failed check still tells the customer no order was sent', async () => {
    codePush.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    expect(await handleStaleExecutionBundle(STALE)).toBe(true);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: 'App update required',
        text2: expect.stringContaining('No order was sent'),
      }),
    );
  });

  test('recognizes only Zerodha Kite hosts', () => {
    expect(isKiteUrl('https://kite.zerodha.com/connect/login')).toBe(true);
    expect(isKiteUrl('https://publisher.kite.zerodha.com/basket')).toBe(true);
    expect(isKiteUrl('https://kite.zerodha.com.attacker.example/')).toBe(false);
  });

  test('bounds account recovery retries and carries operator correlation', () => {
    expect(accountRecoveryMetadata({response: {data: {
      reason: 'account_recovery_running',
      operation_id: 'op-123',
      retry_after_seconds: 90,
    }}})).toEqual({
      running: true,
      operationId: 'op-123',
      retryAfterSeconds: 30,
    });
  });
});
