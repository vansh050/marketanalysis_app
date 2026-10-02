/**
 * Repair-time customer quantity on mobile (P3.2, 2026-09-23).
 *
 * Port of the web affordance. A frozen BUY the customer cannot afford is
 * rejected WHOLE by the broker, and Repair re-offers the same unaffordable
 * quantity forever. This is the one place a customer's number overrides an
 * advisor-approved one, so each guard is pinned as a source contract.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

describe('the editable quantity is confined to a repair BUY', () => {
  test('it is offered only in repair mode, and only on a BUY', () => {
    const gate = SRC.match(/const isRepairQtyEditable = item =>[\s\S]{0,260}?;/);
    expect(gate).not.toBeNull();
    expect(gate[0]).toContain('isRepairMode');
    expect(gate[0]).toContain("'BUY'");
  });

  test('a SELL is never editable — a short sell strands the paired BUY', () => {
    expect(SRC).not.toMatch(/isRepairQtyEditable[\s\S]{0,200}'SELL'/);
  });
});

describe('the advisor quantity is the ceiling', () => {
  test('typing cannot exceed the approved quantity', () => {
    const handler = SRC.match(/const handleRepairQtyChange = \(item, raw\) => \{[\s\S]{0,460}?\n  \};/);
    expect(handler).not.toBeNull();
    expect(handler[0]).toContain('Math.min(parsed, approved)');
    expect(handler[0]).toContain('Math.max(0,');
  });

  test('the displayed value is clamped too, so state can never show more', () => {
    const chosen = SRC.match(/const repairChosenQty = item => \{[\s\S]{0,300}?\n  \};/);
    expect(chosen).not.toBeNull();
    expect(chosen[0]).toContain('Math.min(chosen, approved)');
  });
});

describe('it stays inert until the customer actually reduces something', () => {
  test('only genuine reductions are sent', () => {
    const payload = SRC.match(/const customerReductionPayload = \(\) =>[\s\S]{0,760}?\.filter\(Boolean\);/);
    expect(payload).not.toBeNull();
    expect(payload[0]).toContain('q < approved');
    expect(payload[0]).toContain("transactionType: 'BUY'");
  });

  test('an empty reduction list adds no key to the execute payload', () => {
    const base = SRC.match(/const getBasePayload = \(\) => \(\{[\s\S]{0,760}?\n    \}\);/);
    expect(base).not.toBeNull();
    expect(base[0]).toContain('customerReductionPayload().length');
    expect(base[0]).toContain('{customerQuantities: customerReductionPayload()}');
    expect(base[0]).toContain(': {}');
  });
});

describe('the SDK path carries it too', () => {
  test('customerQuantities is forwarded into executeAdvice', () => {
    // The SDK arg list is an explicit allowlist; an unforwarded field is
    // silently dropped, which is exactly how plan_id went missing before.
    expect(SRC).toMatch(
      /trades: payload\.trades,[\s\S]{0,320}?customerQuantities: payload\.customerQuantities/,
    );
  });
});

describe('the customer is told what they are giving up', () => {
  test('the row shows the approved quantity and what is left unbought', () => {
    expect(SRC).toContain('of {repairApprovedQty(item)}');
    expect(SRC).toContain('not bought');
  });

  test('the input is labelled with its ceiling for screen readers', () => {
    expect(SRC).toMatch(/accessibilityLabel=\{`Quantity to buy for \$\{item\.symbol\}, up to \$\{repairApprovedQty\(item\)\}`\}/);
  });
});
