// Upstox keeps one live session per account. When quick reconnect is enabled
// during connect, its check logs in again and the server saves that newer
// token. The SDK pilot dual-write must not then persist the earlier OAuth
// token (revoked by Upstox) — it did on 2026-10-23 and the card flipped to
// "Session Expired" right after "Connected Successfully".
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../components/BrokerConnectionModal/upstoxModal.js'),
  'utf8',
);

describe('Upstox connect + quick reconnect', () => {
  it('skips the SDK dual-write once quick reconnect replaced the token', () => {
    expect(src).toMatch(
      /if \(!quickReconnectSaved && sdkBridge\.enabled && sdkBridge\.ready && sdkBridge\.client\)/,
    );
  });

  it('decides that only after the quick reconnect check has run', () => {
    const verify = src.indexOf('quickReconnectSaved = await verifyAndSaveQuickReconnect()');
    const dualWrite = src.indexOf('if (!quickReconnectSaved && sdkBridge.enabled');
    expect(verify).toBeGreaterThan(-1);
    expect(dualWrite).toBeGreaterThan(verify);
  });
});
