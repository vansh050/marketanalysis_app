const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('broker-scoped All Holdings', () => {
  test('contains no model-plan selector, filtering, or summary path', () => {
    const container = read('src/screens/PortfolioScreen/PortfolioScreen.js');
    const presentation = read('designs/default/screens/PortfolioScreen.js');
    const summary = read('src/screens/PortfolioScreen/PortFolioCard.js');

    expect(container).not.toContain('fetchPlanHoldings');
    expect(container).not.toContain('planHoldings');
    expect(container).not.toContain('showPlanPicker');
    expect(container).not.toContain('selectedPlan');
    expect(presentation).toContain('data={BrokerHoldingsData?.holding}');
    expect(presentation).not.toContain('selectedPlan');
    expect(summary).not.toContain('Selected plan holdings');
    expect(summary).toContain("'Broker Holdings P&L'");
  });

  test('preserves and labels the last verified broker snapshot after Ignore', () => {
    const context = read('src/screens/TradeContext.js');
    const container = read('src/screens/PortfolioScreen/PortfolioScreen.js');
    const presentation = read('designs/default/screens/PortfolioScreen.js');

    expect(context).toContain('saveBrokerHoldingsSnapshot({');
    expect(context).toContain('loadBrokerHoldingsSnapshot(userEmail, broker)');
    expect(container).toContain('staleHoldingsAcknowledged');
    expect(container).toContain('last successful refresh unavailable');
    expect(container).toContain('>\n                Ignore\n');
    expect(presentation).toContain('Data is stale');
    expect(presentation).toContain(
      'Showing broker holdings as of {staleHoldingsAsOf}.',
    );
  });
});
