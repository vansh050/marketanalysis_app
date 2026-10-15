/**
 * Kyzen QA 2026-10-15: a phone-saved Groww login must reconnect in one tap
 * (like Fyers quick reconnect) and must not ask for the IP-whitelist tick
 * again; an older record without the TOTP token only fills the secret.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../components/BrokerConnectionModal/GrowwConnectModal.js'),
  'utf8',
);

test('a complete saved login submits straight away', () => {
  expect(src).toMatch(/if \(record\?\.seed && record\?\.apiKey\) \{\s*await handleSubmit\(\{fromSavedKey: true/);
});

test('only the saved-key submit skips the IP-whitelist tick', () => {
  expect(src).toContain('const saved = arg && arg.fromSavedKey ? arg : null;');
  expect(src).toContain('if (!egressReady && !saved) {');
});

test('the button says what it does', () => {
  expect(src).toContain("unlockLabel: 'Reconnect with saved key'");
});
