/**
 * 2026-10-13: Accept rebalance -> "Update investment" opened the subscribed
 * portfolio screen with fileName undefined (state not yet set), so it called
 * /portfolios/strategy/undefined and spun on "Loading your holdings…".
 */
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('modify-investment navigation from Accept rebalance', () => {
  test('handleAcceptRebalance navigates with the resolved model name', () => {
    const src = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    const start = src.indexOf('const handleAcceptRebalance = async');
    const end = src.indexOf('\n  const ', start + 40);
    const body = src.slice(start, end);
    expect(body).toContain('fileName: targetName,');
    expect(body).not.toContain('fileName: storeModalName,');
  });

  test('the portfolio screen ends its spinner when the model cannot be resolved', () => {
    const src = read('src/screens/Home/AfterSubscriptionScreen.js');
    expect(src).toMatch(/if \(!fileName \|\| fileName === 'undefined'\) \{\s*setPortfolioLoading\(false\);/);
  });

  test('a budget too low for every stock offers Update investment amount, not only Go Back', () => {
    // 2026-10-13: switching to a broker with no investment amount (Kotak,
    // Zerodha) skipped every stock and the notice offered only 'Go Back'.
    const src = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    expect(src).toContain("? 'Update investment amount'");
    expect(src).toMatch(/needsInvestmentUpdate\s*\?\s*openUpdateInvestment/);
    expect(src).toMatch(/openModifyInvestment: true/);
    // declared after the values it reads (no temporal-dead-zone crash)
    expect(src.indexOf('const needsInvestmentUpdate')).toBeGreaterThan(src.indexOf('const hasPendingSellAuthorization ='));
  });

  test('a broker cash shortfall offers the full-target attempt, not an investment update', () => {
    const src = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    expect(src).toContain("? 'Add funds to continue'");
    expect(src).toMatch(/fundsShortfallBlocks\s*\?\s*\(fundingConsent\.canAttemptWithInsufficientFunds\s*\?\s*attemptWithInsufficientFunds/);
    expect(src).toMatch(/!fundsShortfallBlocks &&/);
  });
});
