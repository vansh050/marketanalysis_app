const fs = require('fs');

describe('Home market-summary recovery', () => {
  const source = fs.readFileSync(
    'src/screens/Home/hooks/useHomeMarketSummary.js',
    'utf8',
  );

  test('index subscription does not wait for tenant config', () => {
    expect(source).not.toContain('if (!configData) return undefined');
  });

  test('all index cards have an independent recurring REST fallback', () => {
    expect(source).toContain("import { fetchLTPBatch }");
    expect(source).toContain('hydrateIndexLtps();');
    expect(source).toContain('setInterval(hydrateIndexLtps, 30000)');
    expect(source).toContain('INDICES.map(({ symbol, exchange })');
  });
});
