const fs = require('fs');
const path = require('path');

const readAndroidSource = fileName => {
  const find = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = find(absolute);
        if (nested) return nested;
      } else if (entry.name === fileName) {
        return absolute;
      }
    }
    return null;
  };
  const file = find(path.join(process.cwd(), 'android/app/src/main/java'));
  if (!file) throw new Error(`Could not find Android source ${fileName}`);
  return fs.readFileSync(file, 'utf8');
};

describe('OTA install policy', () => {
  test('only exact-target updates activate on a clean restart', () => {
    const entry = fs.readFileSync(path.join(process.cwd(), 'index.js'), 'utf8');

    expect(entry).toContain('checkFrequency: codePush.CheckFrequency.MANUAL');
    expect(entry).toContain('installExactTargetOta');
    expect(entry).toContain('binaryVersion: DeviceInfo.getVersion()');
    expect(entry).not.toContain('checkFrequency: codePush.CheckFrequency.ON_APP_RESUME');
    expect(entry).toContain('installMode: codePush.InstallMode.ON_NEXT_RESTART');
    expect(entry).toContain('mandatoryInstallMode: codePush.InstallMode.ON_NEXT_RESTART');
    expect(entry).not.toContain('mandatoryInstallMode: codePush.InstallMode.IMMEDIATE');
  });

  test('no code path calls an unguarded codePush.sync()', () => {
    // A bare sync() accepts open-ended targets (Production v93 >=3.9.129) and
    // can replace a newer APK's embedded bundle with older code.
    const walk = dir =>
      fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
        return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
      });
    const offenders = [path.join(process.cwd(), 'index.js'), ...walk(path.join(process.cwd(), 'src'))]
      .filter(file => /codePush\.sync\(/.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  test('debug builds use Metro while release builds use signed OTA bundles', () => {
    const entry = fs.readFileSync(path.join(process.cwd(), 'index.js'), 'utf8');
    expect(entry).toContain('const OtaEnabledApp = __DEV__');
    expect(entry).toContain('? App');

    const application = readAndroidSource('MainApplication.kt');

    expect(application).toContain(
      'if (BuildConfig.DEBUG) null else CodePush.getJSBundleFile()',
    );
    expect(application).toContain('clearRetainedOtaAfterBinaryChange()');
    expect(application).toContain('.clearUpdates()');
    expect(application).toContain('native_version_code');

    const debugNetworkPolicy = fs.readFileSync(
      path.join(
        process.cwd(),
        'android/app/src/debug/res/xml/network_security_config.xml',
      ),
      'utf8',
    );
    expect(debugNetworkPolicy).toContain('cleartextTrafficPermitted="true"');
  });
});
