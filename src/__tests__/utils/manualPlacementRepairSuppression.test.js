/**
 * Manual placement must not compete with Repair (2026-09-23).
 *
 * moneyman/dgopujkar: LIQUIDCASE BUY 2801 rejected for insufficient funds at
 * 08:40; Repair placed 2790 at 08:44. For four minutes this modal offered
 * "Mark as Placed" pre-filled with 2801.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '../../components/ModelPortfolioComponents/RecommendationSuccessModal.js'),
  'utf8',
);

describe('a rejection the server retries is withheld from manual placement', () => {
  test('the funds class is classified from the shared helper', () => {
    expect(SRC).toMatch(
      /const isRepairRetriableRejection =\s*\n?\s*isFailureStatus && isInsufficientFundsMessage\(item\);/,
    );
  });

  test('both editor entry points are gated on it', () => {
    const gates = SRC.match(
      /modelId && isFailureStatus && !isRepairRetriableRejection && manualEditingIdx [!=]== index/g,
    );
    expect(gates).not.toBeNull();
    expect(gates.length).toBe(2);
  });

  test('no ungated editor entry point survives', () => {
    expect(SRC).not.toMatch(
      /modelId && isFailureStatus && manualEditingIdx [!=]== index/,
    );
  });

  test('the customer is told not to place it themselves', () => {
    expect(SRC).toContain('buying it twice');
  });
});

describe('the escape hatch survives where we can never place', () => {
  test('cautionary listings are not swept into the funds class', () => {
    const decl = SRC.match(/const isRepairRetriableRejection =[\s\S]{0,140}?;/);
    expect(decl[0]).not.toContain('Cautionary');
    expect(decl[0]).not.toContain('cautionary');
  });
});
