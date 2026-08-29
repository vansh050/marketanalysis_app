const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

describe('empty low-balance rebalance contract', () => {
  test('does not describe an all-skipped allocation as already aligned', () => {
    expect(source).toContain('(hasSkippedStocks ||');
    expect(source).toContain('Investment Amount Needs Review');
    expect(source).toContain('this is not an “already aligned” result');
  });
});
