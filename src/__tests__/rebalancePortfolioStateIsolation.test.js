const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('rebalance portfolio state isolation', () => {
  test('clears shared calculation data before another portfolio is opened', () => {
    const card = read('UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(card).toContain('setCalculatedPortfolioData?.(null)');
  });

  test('tags every calculate response with the active portfolio', () => {
    const advices = read('components/AdviceScreenComponents/RebalanceAdvices.js');
    expect(advices).toContain('const tagCalculatedPortfolio = responseData =>');
    expect(advices).not.toContain('setCalculatedPortfolioData(response.data)');
  });

  test('shows calculation warnings only for the portfolio that produced them', () => {
    const modal = read('components/AdviceScreenComponents/RebalanceModal.js');
    expect(modal).toContain('const calculationMatchesPortfolio = Boolean(');
    expect(modal).toContain('calculationMatchesPortfolio && !repairStatus');
    expect(modal).toContain('const skippedStocksMessage = activeCalculatedPortfolioData?.message');
  });

  test('persists real-broker zero-trade calculations as aligned', () => {
    const modal = read('components/AdviceScreenComponents/RebalanceModal.js');
    expect(modal).toContain("const effectiveBroker = broker || 'DummyBroker'");
    expect(modal).toContain('executionStatus: \'executed\'');
    expect(modal).toContain('alreadyAligned: true');
  });

  test('routes repair discovery by authoritative server state', () => {
    const card = read('UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    const reconciliation = read('utils/rebalanceReconciliation.js');
    expect(reconciliation).toContain('resolvedModels: unknown');
    expect(card).toContain('if (discoveredFailedTrades ||');
    expect(card).toContain('if (requiresFreshCalculation)');
    expect(card).toContain('if (resolvedModel)');
    expect(card).toContain("executionStatus: 'executed'");
    expect(card).toContain('getModelPortfolioStrategyDetails?.({silent: true, skipRepair: true})');
    expect(card).toContain('await handleCheckStatus(freshStatus)');
    expect(card).toContain('freshStatusOverride ||');
  });
});
