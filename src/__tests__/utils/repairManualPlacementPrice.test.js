/**
 * Repair-row "Mark as placed" records what the broker actually filled
 * (2026-10-07).
 *
 * The Repair chip used to save `item.qty` at the live LTP, and sent
 * `actualPrice: null` when no LTP had arrived — the server requires a
 * positive price (it becomes the holding's cost basis), so that save 400'd.
 * The funds / partial / funding-pending / T1 chips also opened the prompt,
 * although Repair re-places those legs itself (see
 * manualPlacementRepairSuppression.test.js for the same rule on the
 * Trade Details modal).
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

describe('Repair-row manual placement', () => {
  test('never sends the live LTP or a null price', () => {
    expect(SRC).not.toMatch(/actualPrice:\s*Number\.isFinite\(ltp\)/);
    expect(SRC).not.toMatch(/actualPrice:\s*null/);
    expect(SRC).toMatch(/async \(item, actual\) =>/);
    expect(SRC).toMatch(/const actualPrice = Number\(actual\?\.price\);/);
  });

  test('refuses to save without a positive whole quantity and price', () => {
    expect(SRC).toMatch(
      /!Number\.isInteger\(actualQty\) \|\|\s*actualQty < 1 \|\|\s*!Number\.isFinite\(actualPrice\) \|\|\s*actualPrice <= 0/,
    );
  });

  test('the editor caps quantity at the approved leg', () => {
    expect(SRC).toMatch(/qty > maxPlacedQty/);
  });

  test('only a cautionary listing can be marked as placed', () => {
    expect(SRC).toMatch(/const canMarkAsPlaced = isCautionary && !isAlreadyMarked;/);
    expect(SRC).toMatch(/disabled=\{!canMarkAsPlaced \|\| isThisRowSubmitting\}/);
    expect(SRC).not.toMatch(/promptMarkAsManuallyPlaced/);
  });
});
