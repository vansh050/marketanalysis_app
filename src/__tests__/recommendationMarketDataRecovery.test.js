const fs = require('fs');

describe('recommendation market-data recovery', () => {
  const manager = fs.readFileSync(
    'src/components/AdviceScreenComponents/DynamicText/WebSocketManager.js',
    'utf8',
  );

  test('joins symbol rooms immediately after the subscription POST', () => {
    expect(manager).toContain("socket.emit('subscribe_symbols', {symbols})");
  });

  test('authenticates both socket and HTTP subscription paths', () => {
    expect(manager).toContain('auth: callback =>');
    expect(manager).toContain('Authorization: `Bearer ${token}`');
  });

  test('heals missing and stale recommendation quotes through REST', () => {
    expect(manager).toContain("import {fetchLTPBatch}");
    expect(manager).toContain('const INITIAL_RECOVERY_DELAY_MS = 4 * 1000');
    expect(manager).toContain('const REST_RECOVERY_INTERVAL_MS = 30 * 1000');
    expect(manager).toContain('recoverPrices(symbols)');
  });

  test('accepts both gateway quote event formats', () => {
    expect(manager).toContain('socket.on("ltp_update"');
    expect(manager).toContain('socket.on("market_data"');
  });
});
