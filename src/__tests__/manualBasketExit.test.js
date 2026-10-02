const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('customer manual basket exit', () => {
  test('basket card exposes reconciliation even for a completely manual entry', () => {
    const card = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    expect(card).toContain('hasReconciliationOpportunity');
    expect(card).toContain('Report a manual entry or exit');
    expect(card).toContain('Report a manual exit');
    expect(card).toContain('<ManualBasketExitModal');
  });

  test('customer-held exposure is not presented as advisor closure advice', () => {
    const container = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    const card = read('designs/default/composites/BasketCard.js');
    expect(container).toContain("basketLifecycle?.reason === 'CUSTOMER_HAS_OPEN_EXPOSURE'");
    expect(card).toContain("text: 'Position Open'");
    expect(card).toContain('Manager has not advised an exit.');
    expect(card).toContain('!isCustomerOpenPosition');
    expect(container).toContain('const hasToTradeQty =');
    expect(container.indexOf('const hasToTradeQty =')).toBeLessThan(
      container.indexOf('const closureQuantity = hasToTradeQty'),
    );
    expect(container).toContain("parsedToTradeQty < 0");
    expect(container).toContain("quantity: isClosure ? closureQuantity");
  });

  test('service uses a fresh Firebase identity and customer-owned endpoints', () => {
    const service = read('src/services/ManualBasketExitService.js');
    expect(service).toContain('getIdToken(true)');
    expect(service).toContain('basket-manual-exit/customer/${path}');
    expect(service).not.toContain('userEmail');
  });

  test('supports entries and exits while execution evidence remains required', () => {
    const modal = read('src/components/ManualBasketExitModal.js');
    expect(modal).toContain('Support/evidence reference (optional)');
    expect(modal).not.toContain('Broker order ID');
    expect(modal).toContain('Number(item.price) > 0');
    expect(modal).toContain('entries: selectedEntries.map(normalize)');
    expect(modal).toContain('exits: exits.map(normalize)');
  });
  test('validates lots and treats basket size as indicative, not a cap', () => {
    const modal = read('src/components/ManualBasketExitModal.js');
    expect(modal).toContain('const badLots =');
    expect(modal).toContain('must be a whole number of 1 or more');
    // Basket lots are indicative; the size must never be presented as a limit.
    expect(modal).not.toContain('(up to {contract.missingEntryLots})');
    expect(modal).toContain('baskets are indicative only');
    expect(modal).toContain('indicative size ${indicative}');
    expect(modal).toContain('Exit lots exceed open position');
    expect(modal).toContain("quantityLabel: 'Exit lots'");
    expect(modal).toContain('Prefilled from your recorded open position');
    expect(modal).toContain('Number(digits) > Number(options.maxQuantity)');
  });

  test('blocks a new entry on a cancelled recommendation while keeping exits', () => {
    const modal = read('src/components/ManualBasketExitModal.js');
    expect(modal).toContain('next?.recommendationCancelled ? []');
    expect(modal).toContain('This recommendation was cancelled');
  });
});
