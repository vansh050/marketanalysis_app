// When quick reconnect is set up during connect, a second login runs and the
// server saves that newer session. The SDK pilot dual-write carries the earlier
// token; if it lands last it restores a token the broker may already have
// revoked. Upstox did exactly that on 2026-10-23 (card flipped to "Session
// Expired" right after "Connected Successfully"); Motilal and Fyers go through
// the shared quick-reconnect gate with the same race.
const fs = require('fs');
const path = require('path');

const read = f =>
  fs.readFileSync(path.join(__dirname, '../components/BrokerConnectionModal', f), 'utf8');

describe('Upstox connect + quick reconnect', () => {
  const src = read('upstoxModal.js');

  it('skips the SDK dual-write whenever quick reconnect was attempted', () => {
    expect(src).toMatch(
      /if \(!quickReconnectAttempted && sdkBridge\.enabled && sdkBridge\.ready && sdkBridge\.client\)/,
    );
  });

  it('captures the attempt before running it (a failed attempt may still have saved a token)', () => {
    const captured = src.indexOf('const quickReconnectAttempted = Boolean(pendingTotpEnrollmentRef.current)');
    const verify = src.indexOf('quickReconnectSaved = await verifyAndSaveQuickReconnect()');
    const dualWrite = src.indexOf('if (!quickReconnectAttempted && sdkBridge.enabled');
    expect(captured).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(captured);
    expect(dualWrite).toBeGreaterThan(verify);
  });
});

describe('quick-reconnect gate: Motilal and Fyers', () => {
  it('the gate tells the wrapped modal when a quick-reconnect login is pending', () => {
    expect(read('DeviceTotpReconnectGate.js')).toMatch(
      /isQuickReconnectPending: \(\) => Boolean\(pendingEnrollment\.current\)/,
    );
  });

  it.each(['MotilalModal.js', 'FyersConnect.js'])('%s skips the dual-write while it is pending', f => {
    const src = read(f);
    expect(src).toMatch(/^\s+isQuickReconnectPending,$/m);
    expect(src).toMatch(/if \(!isQuickReconnectPending\?\.\(\) && sdkBridge\.enabled/);
  });
});
