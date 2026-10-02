const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('standalone manual placement', () => {
  test('sends actual broker evidence through the authenticated customer endpoint', () => {
    const service = read('src/services/StandaloneManualPlacementService.js');
    const modal = read('src/components/StandaloneManualPlacementModal.js');
    expect(service).toContain('api/recommendation/customer/manual-placement');
    expect(service).toContain('Authorization: `Bearer ${firebaseToken}`');
    expect(modal).toContain('quantity: filledQuantity');
    expect(modal).toContain('price: averagePrice');
    expect(modal).toContain('broker: brokerName.trim()');
    expect(modal).toContain('brokerOrderId: brokerOrderId.trim()');
    expect(modal).toContain('Broker order ID');
    expect(modal).toContain('executedAt: executionDate.toISOString()');
  });

  test('standalone automated paths use the authoritative Node writer', () => {
    const advice = read('src/components/AdviceScreenComponents/StockAdvices.js');
    const ignored = read('src/screens/Drawer/IgnoreTradesScreen.js');
    expect(advice).toContain('api/process-trades/order-place');
    expect(advice).toContain('api/process-trades/gtt/process-trades');
    expect(advice).toContain('isBasket && sdkExecuteAdviceEnabled');
    expect(advice).not.toContain('handleConfirmManuallyPlaced');
    expect(ignored).toContain('api/process-trades/order-place');
    expect(ignored).not.toContain('api/zerodha/update-trade-reco');
  });

  test('offers the flow from active and rejected standalone cards', () => {
    const card = read('designs/default/composites/StockCard.js');
    expect(card).toContain('I placed this trade manually');
    expect(card).toContain("['recommend', 'rejected', 'failure', 'failed']");
    expect(card).toContain('onOpenManualPlacement');
  });
});
