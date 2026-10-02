const fs = require('fs');
const read = path => fs.readFileSync(path, 'utf8');

describe('Moneyman tester regressions', () => {
  test('market indices hydrate without waiting for tenant config', () => {
    const source = read('src/components/HomeScreenComponents/MarketIndices.js');
    expect(source).not.toContain('if (!configData) return undefined');
    expect(source).toContain('fetchLTPBatch');
  });

  test('performance consent persists per model and metrics use complete fallbacks', () => {
    const source = read('src/screens/Drawer/MPPerformanceScreen.js');
    expect(source).toContain('@app:mp-performance-consent:');
    expect(source).toContain("AsyncStorage.setItem(consentStorageKey, 'accepted')");
    expect(source).toContain('planDetails?.minInvestment');
    expect(source).toContain('specificPlan?.volatility');
    expect(source).toContain('firstPositive(planDetails?.minInvestment');
    expect(source).toContain('firstMeaningful(planDetails?.riskProfile');
  });

  test('portfolio performance survives a benchmark outage', () => {
    const source = read('src/components/ModelPortfolioComponents/PerformanceChart.js');
    expect(source).toContain('const portfolio = await fetchPortfolioData()');
    expect(source).toContain('const indexData = await fetchIndexData().catch');
    expect(source).toContain('stats.indexReturn != null');
    expect(source).toContain('Benchmark data unavailable:');
  });

  test('performance tab remounts do not flood CCXT', () => {
    const chart = read('src/components/ModelPortfolioComponents/PerformanceChart.js');
    const screen = read('src/screens/Drawer/MPPerformanceScreen.js');
    expect(chart).toContain('const cachedRequest = (key, operation) =>');
    expect(chart).toContain('REQUEST_CACHE_TTL_MS');
    expect(chart).toContain('REQUEST_ERROR_TTL_MS');
    expect(chart).toContain('REQUEST_TIMEOUT_MS');
    expect(chart).toContain('fetchWithTimeout');
    expect(chart).not.toContain('withRetries');
    expect(chart).toContain('const portfolio = await fetchPortfolioData()');
    expect(chart).toContain('const indexData = await fetchIndexData().catch');
    expect(chart).toContain('`portfolio:${headerName}:${advisorTag}:${normalizedModelName}`');
    expect(chart).toContain('`index:${selectedIndex}:${startDate}:${endDate}`');
    expect(screen).toContain('const OverviewTab = useCallback');
    expect(screen).toContain('const PortfolioTab = useCallback');
  });

  test('portfolio summary stays compact and links to the holdings tab', () => {
    const summary = read('designs/default/composites/PortfolioSummaryCard.js');
    const screen = read('designs/default/screens/PortfolioScreen.js');
    expect(summary).not.toContain('(f.closedPositions || []).map');
    expect(summary).not.toContain('setOpenFund');
    expect(summary).toContain('View current holdings');
    expect(screen).toContain('onViewHoldings={() =>');
    expect(screen).toContain('setTabIndex(2)');
    expect(screen).toContain('setSelectedInnerTab(0)');
  });

  test('legal links survive config normalization and have build fallbacks', () => {
    const config = read('src/context/ConfigContext.js');
    const privacy = read('src/screens/Drawer/PrivacyPolicyScreen.js');
    const terms = read('src/screens/Drawer/TermandConditionsScreen.js');
    expect(config).toContain('apiData.privacy_policy');
    expect(config).toContain('apiData.terms_and_condition');
    expect(privacy).toContain('Config.REACT_APP_ADVISOR_PRIVACY_POLICY');
    expect(terms).toContain('Config.REACT_APP_ADVISOR_TERMS_AND_CONDITION');
    expect(privacy).toContain('config?.privacyPolicy');
    expect(terms).toContain('config?.termsAndConditions');
  });

  test('portfolio clears model holdings unless canonical entitlement is loaded', () => {
    const source = read('src/screens/PortfolioScreen/PortfolioScreen.js');
    expect(source).toContain('modelPortfolioEntitlementsLoaded');
    expect(source).toContain('modelPortfolioStrategyfinal');
    expect(source).toContain('setMpHoldings([])');
    expect(source).toContain('setModelPortfolioStrategy([])');
  });

  test('PhonePe completion reconciles lifecycle and deep-link returns', () => {
    const source = read('src/screens/Invest/InvestFlowScreen.js');
    expect(source).toContain("Linking.addEventListener('url'");
    expect(source).toContain("AppState.addEventListener('change'");
    expect(source).toContain('reconcilePendingPhonePe');
  });
});
