import fs from 'fs';
import path from 'path';

// moneyman / Groww, 7 Oct 2026: right after a Repair placement the Repair rows
// cleared while YESBANK was still open at the broker, and the empty list
// rendered "Your Portfolio is Already Aligned!". That claim belongs only to a
// real zero-trade calculation.
describe('rebalance empty state', () => {
  const modal = fs.readFileSync(
    path.resolve(__dirname, '../components/AdviceScreenComponents/RebalanceModal.js'),
    'utf8',
  );

  test('"Already Aligned" renders only behind a zero-trade calculation', () => {
    const notAligned = modal.indexOf(') : !isAlreadyAlignedCalculation ? (');
    const aligned = modal.indexOf('Your Portfolio is Already Aligned!');
    expect(notAligned).toBeGreaterThan(-1);
    expect(aligned).toBeGreaterThan(notAligned);
  });

  test('a reconciling Repair says the orders are being confirmed', () => {
    expect(modal).toContain("matchingRepairTrade?.reconciliationPending === true");
    expect(modal).toContain('Orders sent, checking with the broker');
  });
});
