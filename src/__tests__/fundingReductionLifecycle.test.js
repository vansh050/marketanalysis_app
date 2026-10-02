const fs = require('fs');
const path = require('path');

describe('model portfolio funding reduction lifecycle', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'components',
      'ModelPortfolioComponents',
      'MPReviewTradeModal.js',
    ),
    'utf8',
  );

  it('blocks the old basket until the reduced amount is recalculated', () => {
    expect(source).toContain('const [reducingFunding, setReducingFunding]');
    expect(source).toContain('if (reducingFunding) return;');
    expect(source).toContain('await calculateRebalance(availableFundsOptions());');
    expect(source).toContain('await calculateRebalance(insufficientFundsAttemptOptions());');
    expect(source).toContain(
      'calculatedLoading || loading || isLoading || reducingFunding',
    );
  });
});
