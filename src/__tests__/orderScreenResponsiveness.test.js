const fs = require('fs');
const path = require('path');

const container = fs.readFileSync(
  path.resolve(__dirname, '../screens/Home/OrderScreen.js'),
  'utf8',
);
const presentation = fs.readFileSync(
  path.resolve(__dirname, '../../designs/default/screens/OrderScreen.js'),
  'utf8',
);

describe('Orders responsiveness contract', () => {
  it('bounds and deduplicates the full-history fetch', () => {
    expect(container).toContain('timeout: 12000');
    expect(container).toContain('if (inFlightRef.current?.key === requestKey) return inFlightRef.current.promise');
    expect(container).toContain('inFlightRef.current = null');
  });

  it('does not subscribe to a second market summary from Orders', () => {
    expect(container).not.toContain("import useHomeMarketSummary from './hooks/useHomeMarketSummary'");
    expect(container).not.toContain('useHomeMarketSummary()');
  });

  it('shows an actionable error instead of a permanent spinner', () => {
    expect(container).toContain('setLoadError(true)');
    expect(presentation).toContain('Orders could not be refreshed');
    expect(presentation).toContain('onPress={refreshOrders}');
  });

  it('does not turn a normal focus load into a native pull-to-refresh overlay', () => {
    expect(container).toContain('setRefreshing(options?.pullToRefresh === true)');
    expect(presentation).toContain('refreshing={isRefreshing}');
    expect(presentation).not.toContain('refreshing={isLoading}');
  });
});
