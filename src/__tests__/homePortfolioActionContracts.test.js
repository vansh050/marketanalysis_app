const fs = require('fs');

describe('home portfolio action contracts', () => {
  test('adding a holding focuses the symbol field', () => {
    const source = fs.readFileSync(
      'src/components/AdviceScreenComponents/MPStatusModal.js',
      'utf8',
    );
    expect(source).toContain('addFormRequestedFocusRef.current = true');
    expect(source).toContain('newSymbolInputRef.current?.focus()');
    expect(source).toContain('ref={newSymbolInputRef}');
    expect(source).toContain("action: 'keep_outside_plan'");
    expect(source).toContain("action: 'sell_and_remove'");
    expect(source).toContain('holding_removal_actions: pendingReclassificationsRef.current');
    expect(source).toContain('pendingReclassificationsRef.current = next');
    expect(source).toContain("err?.response?.data?.error");
    expect(source).toContain('kept in plan until broker confirms');
  });

  test('review trades scrolls to recommendations instead of opening Plans', () => {
    const bannerContainer = fs.readFileSync(
      'src/components/designContainers/NbaBannerContainer.js',
      'utf8',
    );
    const home = fs.readFileSync(
      'designs/default/screens/HomeScreen.js',
      'utf8',
    );
    expect(bannerContainer).toContain('onReviewTrades?.()');
    expect(bannerContainer).not.toContain("[NBA_KIND.REVIEW_REPAIR_TRADES]: 'Model Portfolio'");
    expect(home).toContain("'RebalanceAdvicesTop'");
    expect(home).toContain("'StockAdvices'");
  });

  test('broker holdings rows remain available to Portfolio Health', () => {
    const fetcher = fs.readFileSync(
      'src/FunctionCall/fetchBrokerAllHoldings.js',
      'utf8',
    );
    const healthContainer = fs.readFileSync(
      'src/components/designContainers/PortfolioHealthSheetContainer.js',
      'utf8',
    );
    expect(fetcher).toContain('holding: Array.isArray(response.data?.holding)');
    expect(healthContainer).toContain('blob.holding ||');
    expect(healthContainer).toContain('source = await getAllHoldings()');
  });
});
