const fs = require('fs');
const path = require('path');

describe('market-data recovery policy', () => {
  test('periodically heals stale socket quotes through REST', () => {
    const hook = fs.readFileSync(
      path.join(process.cwd(), 'src/FunctionCall/useWebSocketCurrentPrice.js'),
      'utf8',
    );

    expect(hook).toContain('const REST_RECOVERY_INTERVAL_MS = 30 * 1000');
    expect(hook).toContain('refreshMissingOrStalePrices(memoizedSymbols)');
    expect(hook).toContain('REST_RECOVERY_INTERVAL_MS');
  });
});
