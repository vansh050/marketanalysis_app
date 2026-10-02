const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('model portfolio tenant-header regression', () => {
  const tradeContext = read('src/screens/TradeContext.js');
  const plansScreen = read('src/screens/Drawer/ModelPortfolioScreen.js');

  test('subscribed strategies and rebalance repair use the canonical resolver', () => {
    const strategyStart = tradeContext.indexOf(
      'const getModelPortfolioStrategyDetails',
    );
    const repairStart = tradeContext.indexOf(
      'const getModelPortfolioRepairTrades',
    );
    const repairEnd = tradeContext.indexOf('\n  useEffect(() => {', repairStart);
    const strategyBody = tradeContext.slice(strategyStart, repairStart);
    const repairBody = tradeContext.slice(repairStart, repairEnd);

    expect(strategyStart).toBeGreaterThan(-1);
    expect(repairStart).toBeGreaterThan(strategyStart);
    expect(repairEnd).toBeGreaterThan(repairStart);
    expect(strategyBody).toContain(
      'const tenantSubdomain = getTenantSubdomain(configData);',
    );
    expect(strategyBody).toContain(
      "'X-Advisor-Subdomain': tenantSubdomain",
    );
    expect(repairBody).toContain(
      'const tenantSubdomain = getTenantSubdomain(configData);',
    );
    expect(repairBody).toContain("'X-Advisor-Subdomain': tenantSubdomain");
    expect(strategyBody).not.toContain(
      "'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME",
    );
    expect(repairBody).not.toContain(
      "'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME",
    );
  });

  test('plan catalog callbacks refresh after tenant config hydration', () => {
    expect(plansScreen).toContain('}, [advisorTag, userEmail, configData]);');
    expect(plansScreen).toContain('}, [configData]);');
    expect(plansScreen).toContain('[userEmail, configData],');
    expect(plansScreen).toContain('}, [userEmail, advisorTag, configData]);');
  });
});
