import fs from 'fs';
import path from 'path';

const read = relative =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('device-owned broker TOTP reconnect contract', () => {
  const dispatch = read(
    'src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js',
  );
  const phase3 = read(
    'src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js',
  );
  const upstox = read(
    'src/components/BrokerConnectionModal/upstoxModal.js',
  );
  const dhan = read(
    'src/components/BrokerConnectionModal/DhanConnectModal.js',
  );
  const kotak = read(
    'src/components/BrokerConnectionModal/KotakModal.js',
  );
  const groww = read(
    'src/components/BrokerConnectionModal/GrowwConnectModal.js',
  );
  const definedge = read(
    'src/components/BrokerConnectionModal/DefinEdgeConnectModal.js',
  );
  const arihant = read(
    'src/components/BrokerConnectionModal/ArihantConnectModal.js',
  );
  const reconnectGate = read(
    'src/components/BrokerConnectionModal/DeviceTotpReconnectGate.js',
  );
  const brokerGuides = read(
    'src/components/BrokerConnectionModal/brokerGuideConfigs.js',
  );
  const fyersConnect = read(
    'src/components/BrokerConnectionModal/FyersConnect.js',
  );
  const stepper = read(
    'src/components/BrokerConnectionModal/BrokerConnectStepperSheet.js',
  );
  const aliceBlue = read(
    'src/components/BrokerConnectionModal/AliceBlueConnect.js',
  );
  const brokerSelection = read('src/components/BrokerSelectionModal.js');
  const stockAdvice = read(
    'src/components/AdviceScreenComponents/StockAdvices.js',
  );
  const brokerCredentialScreen = read(
    'src/screens/Broker/BrokerCredentialScreen.js',
  );

  test('native vault flows are selected only by the existing advisor flag', () => {
    expect(dispatch).toContain('runtimeConfig?.deviceTotpEnabled === true');
    for (const broker of [
      'Kotak',
      'Groww',
      'Upstox',
      'Dhan',
      'DefinEdge Securities',
      'Arihant Capital',
    ]) {
      expect(dispatch).toContain(`key === '${broker}'`);
    }
  });

  test('API credential prefill is not coupled to the TOTP flag', () => {
    const gate = phase3.slice(
      phase3.indexOf('const credentialVaultEnabled'),
      phase3.indexOf('const credentialVaultIdentity'),
    );
    expect(gate).toContain('deviceBrokerCredentialVaultEnabled');
    expect(gate).not.toContain('deviceTotpEnabled');
  });

  test('direct reconnect sends generated codes, never the TOTP seed', () => {
    for (const source of [upstox, dhan]) {
      const start = source.indexOf('const reconnectWithDeviceTotp');
      const segment = source.slice(start, start + 2200);
      expect(segment).toContain('unlockDeviceTotpLogin');
      expect(segment).toContain('Authorization: `Bearer ${firebaseToken}`');
      expect(segment).toContain('totp: login.totp');
      expect(segment).not.toContain('seed: login.seed');
    }
  });

  test('Dhan keeps partner login separate from customer-owned Direct API', () => {
    expect(dhan).toContain("setFlowMode(deviceTotpEnabled ? 'choose' : 'partner')");
    expect(dhan).toContain('connectionMode: \'partner\'');
    expect(dhan).toContain('egressBrokerKey="dhan_direct"');
    expect(dhan).toContain('api/dhan/device-totp-connect');
    expect(dhan).toContain("dhanSlot?.connection_mode === 'direct_api'");
    expect(dhan).toContain('saveDeviceTotpSeed(');
    expect(dhan).toContain('free dedicated static IPv6');
    expect(dhan).not.toContain('dedicated static IPv4');
  });

  test('an expired execution skips the reconnect button when this phone is enrolled', () => {
    expect(brokerSelection).toContain('DEVICE_TOTP_AUTO_RECONNECT');
    expect(brokerSelection).toContain(': hasDeviceTotp(identity))');
    expect(brokerSelection).toContain('setOpenTokenExpireModel(false)');
    expect(brokerSelection).toContain('modalStore.openModal(target.modalKey)');
  });

  test('every quick-reconnect broker auto-opens from an expired card (2026-10-02)', () => {
    // Rebalance, single-trade and basket cards all open the expiry through
    // BrokerSelectionModal, so this one map covers every card.
    for (const key of ['Angel One', 'Zerodha', 'Fyers', 'Motilal', 'Dhan', 'AliceBlue']) {
      expect(brokerSelection).toMatch(new RegExp(`'?${key}'?: \\{broker: `));
    }
    expect(brokerSelection).toContain('hasAliceBlueDeviceLogin(identity)');
    expect(brokerSelection).toContain('deviceTotpEnabled || aliceBlueDeviceLoginEnabled');
  });

  test('flag-off and unenrolled customers retain the normal reconnect flow', () => {
    expect(brokerSelection).toContain('if (!quickReconnectEnabled) return;');
    expect(brokerSelection).toContain('if (!active || !saved) return');
    expect(brokerSelection).toContain(
      'onBrokerLoginPress: handleBrokerSelectOpenExpire',
    );
    expect(reconnectGate).toContain(
      '`Continue with normal ${brokerName} login`',
    );
  });

  test('Fyers first connect offers quick enrollment without hiding mandatory setup', () => {
    const fyersGuide = brokerGuides.slice(
      brokerGuides.indexOf('Fyers: {'),
      brokerGuides.indexOf("'IIFL Securities':"),
    );
    expect(reconnectGate).toContain('PHONE_ENROLLMENT_FIRST_CONNECT_BROKERS');
    expect(reconnectGate).toContain('DEFERRED_OAUTH_FIRST_CONNECT_BROKERS');
    expect(reconnectGate).toContain(
      'active && !PHONE_ENROLLMENT_FIRST_CONNECT_BROKERS.has(brokerName)',
    );
    expect(dispatch).toContain('runtimeConfig?.deviceTotpEnabled === true');
    expect(reconnectGate).toContain('getBrokerGuideConfig(brokerName');
    // First connect / enrollment keeps the mandatory setup (static IP) guide;
    // it is hidden only once quick reconnect is saved AND usable.
    expect(reconnectGate).toContain(
      '!quickReconnectReady && setupGuide ? definition.egressBrokerKey : null',
    );
    expect(reconnectGate).toContain(
      'const quickReconnectReady = hasSaved && !requiresOAuth && !checking;',
    );
    expect(reconnectGate).toContain('customerId={serverUserId.current}');
    expect(reconnectGate).toContain('customerEmail={userEmail}');
    expect(reconnectGate).toContain("label: 'App ID'");
    expect(reconnectGate).toContain("label: 'Secret ID'");
    expect(reconnectGate).toContain('Enter every customer-owned API credential');
    expect(fyersGuide).toContain('“Algo trading app”');
    expect(fyersGuide).toContain('<b>Do not</b> press <b>Create App</b>');
    expect(fyersGuide).toContain('Paste the <b>static IP</b>');
    expect(fyersGuide).toContain('Click <b>Activate</b>');
    expect(reconnectGate).toContain('pendingEnrollment.current = {');
    expect(reconnectGate).toContain('React.cloneElement(fallback');
    expect(reconnectGate).toContain('initialCredentials: stagedApiCredentials');
    expect(reconnectGate).toContain("autoStart: brokerName === 'Fyers'");
    expect(fyersConnect).toContain('autoStartHandled.current = true');
    expect(fyersConnect).toContain('updateSecretKey();');
    // Enrollment runs after the connect confirmation, never before it.
    const fallbackSuccess = reconnectGate.slice(
      reconnectGate.indexOf('const handleFallbackSuccess'),
      reconnectGate.indexOf('const finishSuccess'),
    );
    expect(fallbackSuccess).toContain('finishPendingEnrollment();');
    expect(fallbackSuccess).not.toContain('await finishPendingEnrollment()');
    expect(fallbackSuccess.indexOf('await fetchBrokerStatusModal')).toBeLessThan(
      fallbackSuccess.indexOf('finishPendingEnrollment();'),
    );
    expect(reconnectGate).toContain("recordBreadcrumb('enrollment_failed'");
    // Enrollment verifies with the NEXT TOTP window and retries once.
    const enrollment = reconnectGate.slice(
      reconnectGate.indexOf('const finishPendingEnrollment'),
      reconnectGate.indexOf('const handleFallbackSuccess'),
    );
    expect(enrollment).toContain('await waitForNextTotpWindow();');
    expect(enrollment).toContain('isRetryableEnrollmentError(firstError)');
    expect(enrollment).toContain("recordBreadcrumb('enrollment_retry'");
    expect(reconnectGate).toContain('generateDeviceTotpFromSeed(pending.seed)');
    expect(reconnectGate).toContain(
      '`${brokerName} connected; quick reconnect was not saved`',
    );
  });

  test('host reconnect uses refreshed server state and never routes Fyers through the SDK', () => {
    expect(reconnectGate).toContain('getServerBrokerReconnectState(');
    expect(reconnectGate).toContain('nextState.requiresOAuth');
    expect(reconnectGate).toContain("branch: 'oauth'");
    expect(reconnectGate).toContain("branch: 'quick_reconnect'");
    expect(reconnectGate).toContain("recordBreadcrumb('server_state_resolved'");
    expect(reconnectGate).not.toContain('Phase3SdkBrokerModal');
  });

  test('invalid setup stays inline and keyboard navigation avoids stacked overlays', () => {
    const invalidSetup = reconnectGate.slice(
      reconnectGate.indexOf('const submitEnrollment'),
      reconnectGate.indexOf('const apiCredentialFields'),
    );
    expect(invalidSetup).toContain("setValidationError(");
    expect(invalidSetup).not.toContain("showAlert('error', 'Invalid TOTP setup'");
    expect(reconnectGate).toContain('error={validationError}');
    expect(stepper).toContain("returnKeyType={i < fields.length - 1 ? 'next' : 'done'}");
    expect(stepper).toContain('inputRefs.current[nextKey]?.focus?.()');
    expect(stepper).toContain('const SetupGuideCard = React.memo');
    expect(stepper).toContain('const egressCallout = useMemo');
  });

  test('normalised reconnect fields are uncontrolled so a busy JS thread cannot drop keys', () => {
    const fieldBlock = reconnectGate.slice(
      reconnectGate.indexOf('const apiCredentialFields'),
      reconnectGate.indexOf('return (\n    <BrokerConnectStepperSheet'),
    );
    expect(fieldBlock).toContain("key: `api-${field.key}`");
    expect(fieldBlock).toContain('uncontrolled: true');
    expect(stepper).toContain('{ defaultValue: f.value }');
    expect(stepper).toContain('key={fieldKey}');
    expect(stepper).toContain('setNativeProps?.({');
    expect(stepper).toContain('secureTextEntry: !nextShown');
    expect(stepper).toContain("autoCapitalize={f.autoCapitalize || 'none'}");
  });

  test('TOTP setup-key fields preserve pasted case and canonicalise only when used', () => {
    expect(reconnectGate).toContain("setSeed(String(value || ''));");
    expect(reconnectGate).toContain("autoCapitalize: 'none'");
    expect(upstox).toContain("setDeviceTotpSeed(String(t || ''))");
    expect(dhan).toContain("setDeviceTotpSeed(String(value || ''))");
    expect(kotak).toContain("setDeviceTotpSeed(String(t || ''))");
    expect(definedge).toContain("setDeviceTotpSeed(String(t || ''))");
    expect(arihant).toContain("setDeviceTotpSeed(String(t || ''))");
    expect(aliceBlue).toContain("setAliceTotpSeed(String(value || ''))");
    expect(brokerCredentialScreen).toContain('autoCapitalize="none"');

    for (const [source, label] of [
      [upstox, "label: 'TOTP Secret Key (Base32)'"],
      [dhan, "label: 'TOTP Secret Key (Base32)'"],
      [kotak, "label: 'TOTP Secret Key (Base32)'"],
      [definedge, "label: 'External TOTP Secret Key (Base32)'"],
      [arihant, "label: 'TOTP Secret Key (Base32)'"],
      [aliceBlue, "label: 'TOTP Secret Key (Base32)'"],
    ]) {
      const fieldStart = source.indexOf(label);
      expect(fieldStart).toBeGreaterThanOrEqual(0);
      const field = source.slice(fieldStart, fieldStart + 520);
      expect(field).not.toContain('toUpperCase()');
    }
  });

  test('gate hands its fetched user id to the Fyers OAuth fallback', () => {
    expect(reconnectGate).toContain('serverUserId.current = response.data?.User?._id');
    expect(reconnectGate).toContain('initialUserId: serverUserId.current');
  });

  test('every phone-TOTP enrollment surface keeps required customer credentials and setup guidance visible', () => {
    for (const expected of [
      "label: 'SmartAPI API Key'",
      "label: 'API Key'",
      "label: 'Client Code'",
      "label: 'App ID'",
      "label: 'Secret ID'",
      "egressBrokerKey: 'angelone'",
      "egressBrokerKey: 'motilaloswal'",
      "egressBrokerKey: 'fyers'",
    ]) {
      expect(reconnectGate).toContain(expected);
    }
    expect(reconnectGate).toContain(
      'const ok = await reconnect({totp: generatedCode, ...values, ...apiPayload})',
    );
    expect(reconnectGate).toContain('definition.apiValid(apiValues)');
    for (const broker of ['Angel One', 'Motilal Oswal', 'Zerodha', 'Fyers']) {
      expect(reconnectGate).toContain(`'${broker}'`);
    }

    const angelGuide = brokerGuides.slice(
      brokerGuides.indexOf("'Angel One':"),
      brokerGuides.indexOf("'DefinEdge Securities':"),
    );
    const angelOverride = phase3.slice(
      phase3.indexOf("if (brokerName === 'Angel One')"),
      phase3.indexOf('// Default credential brokers'),
    );
    expect(angelGuide).toContain('Copy your <b>API Key</b>');
    expect(angelGuide).toContain('does not issue or require an API Secret');
    expect(angelGuide).not.toContain('API Key</b> and <b>Secret');
    expect(angelOverride).toContain('prerequisites: []');
    expect(angelOverride).not.toContain("name: 'secretKey'");

    // Zerodha and AliceBlue are partner-login products: there is no
    // customer-owned developer App ID/static-IP credential to request.
    expect(reconnectGate).toContain("Zerodha: {");
    expect(aliceBlue).toContain('existing AliceBlue partner login');
    // AliceBlue must read the same live flag the dispatcher routed on; the
    // cached TradeContext config alone hid its quick-reconnect choice.
    expect(aliceBlue).toContain('freshConfig?.deviceTotpEnabled === true');
    for (const file of ['KotakModal.js', 'GrowwConnectModal.js']) {
      const source = fs.readFileSync(
        path.join(__dirname, '../components/BrokerConnectionModal', file),
        'utf8',
      );
      expect(source).toContain('freshConfig?.deviceTotpEnabled === true');
      expect(source).toContain('placeBeforeFields: true');
    }

    // Native phone-TOTP modals already render their complete credential set
    // beside the broker guide and IP gate; pin those contracts too.
    expect(upstox).toContain("label: 'API Key'");
    expect(upstox).toContain("label: 'Secret Key'");
    expect(upstox).toContain('egressBrokerKey="upstox"');
    expect(dhan).toContain("label: 'Dhan Client ID'");
    expect(dhan).toContain('egressBrokerKey="dhan_direct"');
    expect(kotak).toContain("label: 'API Access Token'");
    expect(kotak).toContain('egressBrokerKey="kotak"');
    expect(groww).toContain("label: 'TOTP Token (API Key)'");
    expect(groww).toContain('egressBrokerKey="groww"');
    expect(definedge).toContain("label: 'API Token'");
    expect(definedge).toContain("label: 'API Secret'");
    expect(definedge).toContain('egressBrokerKey="definedge"');
    expect(arihant).toContain("label: 'API Key (App ID)'");
    expect(arihant).toContain('egressBrokerKey="arihant"');
  });

  test('quick-reconnect enrollment explains how to create each broker TOTP key before showing its fields', () => {
    expect(reconnectGate).toContain("title: 'Create your Angel One TOTP key first'");
    expect(reconnectGate).toContain('https://smartapi.angelone.in/enable-totp');
    expect(reconnectGate).toContain('manual secret key shown below the QR');
    expect(reconnectGate).toContain("title: 'Find your Motilal TOTP secret key'");
    expect(reconnectGate).toContain('32-character TOTP Secret Key');
    expect(reconnectGate).toContain("title: 'Create your Zerodha external TOTP key'");
    expect(reconnectGate).toContain('Can’t scan? Copy the key');
    expect(reconnectGate).toContain("title: 'Enable FYERS external TOTP first'");
    expect(reconnectGate).toContain('Profile → Others → External 2FA TOTP → Enable');
    expect(reconnectGate).toContain('placeBeforeFields: true');
    expect(reconnectGate).toContain('setup: definition.totpSetup');

    const control = stepper.slice(
      stepper.indexOf('const DeviceTotpControl'),
      stepper.indexOf('const BrokerConnectStepperSheet'),
    );
    expect(control).toContain('showSetup');
    expect(control).toContain("setup.title || 'How to create your TOTP key'");
    expect(control).toContain("setup.portalLabel || 'Open TOTP setup'");
    expect(stepper.indexOf('deviceTotp?.placeBeforeFields')).toBeLessThan(
      stepper.indexOf('fields.map((f, i)'),
    );
  });

  test('Upstox derives TOTP from the setup key, verifies a fresh broker code, then saves the phone vault', () => {
    const start = upstox.indexOf('const updateSecretKey');
    const preflight = upstox.slice(start, upstox.indexOf('const handleWebViewNavigationStateChange'));
    expect(preflight).toContain('normalizeDeviceTotpSeedInput(deviceTotpSeed)');
    expect(preflight).toContain('generateDeviceTotpFromSeed(normalizedSeed)');
    expect(preflight).toContain("'Check the Upstox TOTP secret'");
    expect(upstox).toContain("label: 'Continue with normal Upstox login'");
    expect(upstox).toContain('updateSecretKey(true)');

    const enrollment = upstox.slice(
      upstox.indexOf('const verifyAndSaveQuickReconnect'),
      start,
    );
    expect(enrollment).toContain('await waitForNextTotpWindow()');
    expect(enrollment).toContain('generateDeviceTotpFromSeed(pending.seed)');
    expect(enrollment).toContain('api/upstox/device-totp-reconnect');
    expect(enrollment.indexOf('api/upstox/device-totp-reconnect')).toBeLessThan(
      enrollment.indexOf('await saveDeviceTotpSeed'),
    );
    expect(upstox).toContain('placeBeforeFields: true');
    expect(upstox).toContain('the app generates and verifies a fresh code after OAuth');
    expect(upstox).toContain('Upstox connected; quick reconnect needs setup again');
    expect(upstox).not.toContain('Upstox connected; quick reconnect was not saved');
  });

  test('phone enrollment never asks the customer to copy a rotating TOTP code', () => {
    for (const source of [reconnectGate, upstox, dhan, aliceBlue]) {
      expect(source).not.toContain("label: 'Current TOTP'");
    }
    expect(dhan).toContain('generateDeviceTotpFromSeed(deviceTotpSeed)');
    expect(kotak).toContain('generateDeviceTotpFromSeed(deviceTotpSeed)');
    expect(definedge).toContain('generateDeviceTotpFromSeed(deviceTotpSeed)');
  });

  test('Zerodha uses the current official portal path and waits for a user biometric gesture', () => {
    expect(reconnectGate).toContain(
      'My profile / Settings → Password & Security',
    );
    expect(reconnectGate).toContain('Can’t scan? Copy the key');
    expect(reconnectGate).not.toContain('autoStarted.current');
    expect(reconnectGate).toContain("'Authenticate to reconnect'");
  });

  test('AliceBlue offers assisted and manual variants of the same partner login', () => {
    expect(dispatch).toContain(
      'runtimeConfig?.deviceTotpEnabled === true ||',
    );
    expect(dispatch).toContain(
      'runtimeConfig?.aliceBlueDeviceLoginEnabled === true',
    );
    expect(aliceBlue).toContain(
      'configData?.config?.deviceTotpEnabled === true',
    );
    expect(aliceBlue).toContain('Quick Reconnect on this phone');
    expect(aliceBlue).toContain('Use Normal AliceBlue Login');
    expect(aliceBlue).toContain(
      'Both choices use AlphaQuark’s existing AliceBlue partner login.',
    );
    expect(aliceBlue).toContain('assistedCredentials={assistedCredentialsRef.current}');
    expect(aliceBlue).toContain('authUrl={buildAliceBlueAuthUrl()}');
  });

  test('successful biometric reconnect resumes pending execution listeners', () => {
    expect(reconnectGate).toContain("eventEmitter.emit('refreshEvent'");
    expect(reconnectGate).toContain('`${brokerName} broker connection`');
    expect(stockAdvice).toContain('pendingReconnectActionRef');
    expect(stockAdvice).toContain('resumeAfterReconnect');
    expect(stockAdvice).toContain("session?.brokerStatus !== 'connected'");
    expect(stockAdvice).toContain('pending.resume?.(session)');
  });

  test('saved quick reconnect leads with biometric unlock as the primary action', () => {
    // 2026-10-01 Fyers report: with quick reconnect saved, the primary button
    // was the disabled "Verify & enable quick reconnect" and the working
    // unlock was a small link customers missed.
    expect(reconnectGate).toMatch(
      /onSubmit=\{\s*quickReconnectReady\s*\?\s*unlockAndReconnect\s*:\s*normalLoginDefault\s*\?\s*goNormalLogin\s*:\s*submitEnrollment\s*\}/,
    );
    expect(reconnectGate).toContain("? 'Reconnect with biometric unlock'");
    expect(reconnectGate).toMatch(/canSubmit=\{\s*quickReconnectReady \|\|/);
    expect(reconnectGate).toContain(
      'config={quickReconnectReady ? quickReconnectConfig : sheetConfig}',
    );
    // No duplicate small link while the unlock is the primary button.
    expect(reconnectGate).toContain(
      'onUnlock: hasSaved && !quickReconnectReady ? unlockAndReconnect : undefined',
    );
  });

  test('normal broker login is the default CTA; quick reconnect is opt-in', () => {
    // 2026-10-02: Dhan / AliceBlue / Zerodha opened on quick-reconnect setup.
    // The default must be the broker's own (partner) login; enabling quick
    // reconnect on this phone is what switches the CTA.
    expect(reconnectGate).toContain(
      'const normalLoginDefault = !quickReconnectReady && !hasSaved && !saveOnDevice;',
    );
    expect(reconnectGate).toContain('`Continue with ${brokerName} login`');
    expect(reconnectGate).toMatch(/alternateAction=\{\s*normalLoginDefault\s*\?\s*undefined/);
    expect(aliceBlue).toContain('const normalLoginDefault = !hasSavedLogin && !quickReconnectOptIn;');
    expect(aliceBlue).toContain('Continue with AliceBlue login');
    expect(dhan).toContain("directOptIn ? 'Set up Direct API Quick Reconnect' : 'Continue with Dhan login'");
    expect(dhan).toContain("setFlowMode(directOptIn ? 'direct' : 'partner')");
  });

  test('the connect sheet header shows the real broker logo', () => {
    expect(stepper).toContain("import { brokerDisplayConfig } from '../../config/brokerDisplayConfig';");
    expect(stepper).toContain('testID="broker-connect-logo"');
    // Monogram stays as the fallback for brokers without a bundled asset.
    expect(stepper).toContain('config.monogram || String(broker');
  });
});