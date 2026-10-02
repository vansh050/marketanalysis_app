import {installExactTargetOta, isExactOtaTargetForBinary, otaTargetMarker} from '../../utils/otaPolicy';

describe('exact-target OTA policy', () => {
  const marker = otaTargetMarker('android', '3.9.170');

  test('accepts only a release that declares this exact binary', () => {
    expect(isExactOtaTargetForBinary('3.9.170', '3.9.170', `fix ${marker}`, 'android')).toBe(true);
    expect(isExactOtaTargetForBinary('>=3.9.129', '3.9.170', marker, 'android')).toBe(false);
    expect(isExactOtaTargetForBinary('3.9.169', '3.9.170', marker, 'android')).toBe(false);
  });

  test('rejects the server-echoed open-ended release (live v93 shape)', () => {
    // Revopush answers a ">=3.9.129" release with the CALLER's version.
    expect(isExactOtaTargetForBinary('3.9.170', '3.9.170', 'ddce059: device TOTP reconnect', 'android')).toBe(false);
    expect(isExactOtaTargetForBinary('3.9.170', '3.9.170', undefined, 'android')).toBe(false);
  });

  test('a marker for the other platform or version does not count', () => {
    expect(isExactOtaTargetForBinary('3.9.170', '3.9.170', otaTargetMarker('ios', '3.9.170'), 'android')).toBe(false);
    expect(isExactOtaTargetForBinary('3.9.170', '3.9.170', otaTargetMarker('android', '3.9.17'), 'android')).toBe(false);
  });

  test('does not download v93 even though the server echoes our version', async () => {
    const download = jest.fn();
    const codePush = {
      checkForUpdate: jest.fn(async () => ({appVersion: '3.9.170', label: 'v93', description: 'ddce059', download})),
      InstallMode: {ON_NEXT_RESTART: 'ON_NEXT_RESTART'},
    };
    await expect(installExactTargetOta({codePush, binaryVersion: '3.9.170', platform: 'android'})).resolves.toEqual({
      status: 'target_rejected',
      target: '3.9.170',
      label: 'v93',
    });
    expect(download).not.toHaveBeenCalled();
  });

  test('downloads a marked exact release and stages it for a clean restart', async () => {
    const install = jest.fn(async () => {});
    const download = jest.fn(async () => ({install}));
    const codePush = {
      checkForUpdate: jest.fn(async () => ({appVersion: '3.9.170', label: 'v101', description: marker, download})),
      InstallMode: {ON_NEXT_RESTART: 'ON_NEXT_RESTART'},
    };
    await expect(installExactTargetOta({codePush, binaryVersion: '3.9.170', platform: 'android'})).resolves.toEqual({
      status: 'installed_for_next_restart',
      label: 'v101',
    });
    expect(install).toHaveBeenCalledWith('ON_NEXT_RESTART');
  });

  test('every release script stamps the marker', () => {
    const pkg = require('../../../package.json');
    const otaScriptNames = [
      'ota:android:staging',
      'ota:android:production',
      'ota:ios:staging',
      'ota:ios:production',
    ];
    const configuredOtaScripts = otaScriptNames.filter(name => pkg.scripts[name]);
    if (configuredOtaScripts.length === 0) {
      expect(Object.keys(pkg.scripts).filter(name => name.startsWith('ota:'))).toEqual([]);
      return;
    }
    expect(configuredOtaScripts).toHaveLength(otaScriptNames.length);
    for (const name of ['ota:android:staging', 'ota:android:production']) {
      expect(pkg.scripts[name]).toContain('[aq-target android $npm_package_config_ota_android_target]');
    }
    for (const name of ['ota:ios:staging', 'ota:ios:production']) {
      expect(pkg.scripts[name]).toContain('[aq-target ios $npm_package_config_ota_ios_target]');
    }
  });
});
