import {investmentTarget, investmentEntry} from '../../utils/investmentTarget';
const preview = {status: 0, baseInvestmentAmount: 100000, pnlAvailable: true,
  netPnl: 15000, pnlQuoteId: 'quote', asOf: new Date().toISOString()};
test.each([['full', 120000], ['topup', 20000]])('%s confirms the same absolute target', (mode, entered) => {
  expect(investmentTarget({mode, entered, preview, includePnl: false}).total).toBe(120000);
  expect(investmentTarget({mode, entered, preview, includePnl: true}).total).toBe(135000);
  const raw = investmentEntry({mode, entered, preview, includePnl: true, dateTime: 'now'});
  expect(raw.changeMode).toBe('full');
  expect(raw.baseInvestmentAmount).toBe(120000);
  expect(raw.pnlAdjustment).toBe(15000);
});
test('losses are included with their sign', () => {
  expect(investmentTarget({mode: 'full', entered: 120000,
    preview: {...preview, netPnl: -15000}, includePnl: true}).total).toBe(105000);
});
test('missing or stale P&L cannot be silently used', () => {
  expect(investmentTarget({mode: 'full', entered: 120000, preview: null, includePnl: true})).toBeNull();
  expect(investmentTarget({mode: 'full', entered: 120000,
    preview: {...preview, asOf: '2000-01-01'}, includePnl: true})).toBeNull();
});
test('without P&L full amount still works when preview is unavailable', () => {
  expect(investmentTarget({mode: 'full', entered: 120000, preview: null, includePnl: false}).total).toBe(120000);
  expect(investmentTarget({mode: 'topup', entered: 20000, preview: null, includePnl: false})).toBeNull();
});
test.each(['', -1, 'nan', 'Infinity'])('invalid input %s cannot be confirmed', entered => {
  expect(investmentTarget({mode: 'full', entered, preview})).toBeNull();
});
test('negative final target is not silently clipped to zero', () => {
  expect(investmentTarget({mode: 'full', entered: 10000,
    preview: {...preview, netPnl: -15000}, includePnl: true})).toBeNull();
});
