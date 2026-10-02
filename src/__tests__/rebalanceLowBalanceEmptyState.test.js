const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

describe('empty low-balance rebalance contract', () => {
  test('does not describe an all-skipped allocation as already aligned', () => {
    expect(source).toContain('hasSkippedStocks ||');
    expect(source).toContain('Investment Amount Needs Review');
    expect(source).toContain('this is not an “already aligned” result');
  });

  test('does not describe an empty sell-authorization retry as already aligned', () => {
    expect(source).toContain('!hasPendingSellAuthorization');
    expect(source).toContain('Sell Authorization Still Pending');
    expect(source).toContain('this rebalance is not complete and your portfolio is not yet aligned');
    expect(source).toContain('Dependent buy orders remain unplaced until the sells complete');
    expect(source).toContain('Retry Sell Authorization');
  });
});
