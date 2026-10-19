const fs = require('fs');
const path = require('path');

const findFile = (dir, name) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(full, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
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

    const mainApplication = findFile(
      path.join(process.cwd(), 'android/app/src/main/java'),
      'MainApplication.kt',
    );
    expect(mainApplication).toBeTruthy();
    const application = fs.readFileSync(mainApplication, 'utf8');
    expect(application).toContain(
      'if (BuildConfig.DEBUG) null else CodePush.getJSBundleFile()',
    );
    expect(application).toContain('clearRetainedOtaAfterBinaryChange()');
    expect(application).toContain('.clearUpdates()');
    expect(application).toContain('native_version_code');
  });

  // Each white-label app owns its Revopush apps and signing key. A copied
  // deployment key or public key lets another tenant's OTA replace this
  // app's JavaScript (Kyzen carried AlphaPro's keys until 2026-10-19).
  test('the app embeds its own deployment and public keys', () => {
    const strings = fs.readFileSync(
      path.join(process.cwd(), 'android/app/src/main/res/values/strings.xml'),
      'utf8',
    );
    const plist = fs.readFileSync(
      path.join(process.cwd(), 'ios/AlphaQuark/Info.plist'),
      'utf8',
    );
    const gradle = fs.readFileSync(
      path.join(process.cwd(), 'android/app/build.gradle'),
      'utf8',
    );
    const androidPublic = strings.match(/CodePushPublicKey">([\s\S]*?)<\/string>/)[1].replace(/\s/g, '');
    const iosPublic = plist.match(/CodePushPublicKey<\/key>\s*<string>([\s\S]*?)<\/string>/)[1].replace(/\s/g, '');
    expect(androidPublic).toContain('BEGINPUBLICKEY');
    expect(iosPublic).toBe(androidPublic);
    expect(gradle).toMatch(/CODEPUSH_DEPLOYMENT_KEY"\) \?: "[A-Za-z0-9_-]{20,}"/);
    expect(plist).toMatch(/CodePushDeploymentKey<\/key>\s*<string>[A-Za-z0-9_-]{20,}<\/string>/);
    expect(plist).not.toContain('CodePushEnabled');
    // AlphaPro's embedded public key must never appear in another app.
    expect(androidPublic).not.toContain('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyLiagUCip1Dgx4v0wtnI');
  });
});
