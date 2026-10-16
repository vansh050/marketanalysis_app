/**
 * Model-portfolio detail "Accept rebalance": the calculate request must always
 * carry model_id and userFund (JSON drops undefined fields and the server then
 * answers 400 "<key> is missing"), and a failure must be shown, not swallowed
 * (2026-10-13 Kyzen: "Accept rebalance does not move to the next step").
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../screens/Drawer/MPPerformanceScreen.js'), 'utf8');

test('model_id falls back to the strategy rebalance history, never undefined', () => {
  expect(src).toContain('latestRebalance?.model_Id ||');
  expect(src).toContain('history[history.length - 1]?.model_Id');
  expect(src).toContain('model_id: rebalanceModelId,');
  expect(src).toMatch(/if \(!rebalanceModelId\) \{[\s\S]{0,200}Alert\.alert\(\s*'Rebalance not ready'/);
});

test('userFund is never omitted', () => {
  expect(src).toContain("(funds?.data?.availablecash ?? '0')");
});

test('a calculate failure is shown to the customer', () => {
  expect(src).not.toContain('.catch(() => { setCalculateLoading(false); });');
  expect(src).toMatch(/\.catch\(error => \{[\s\S]{0,120}Alert\.alert\(\s*'Could not prepare the rebalance'/);
});
