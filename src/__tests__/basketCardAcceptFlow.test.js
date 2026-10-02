const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('basket card accept flow', () => {
  test('an enabled CTA opens from the polled decision without a duplicate request', () => {
    const card = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    expect(card).toContain('confirmOutOfRange(entryAuthorization)');
    expect(card).not.toContain("route: 'mobile_basket_card_click'");
    expect(card).toContain("route: 'mobile_basket_card'");
  });

  test('wires basket orders into the stockDetails state consumed by the review modal', () => {
    const content = read('src/components/AdviceScreenComponents/StockAdviceContent.js');
    const card = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    expect(content).toContain('setStockDetails={setStockDetails}');
    expect(content).not.toContain('setStockDetails={setBasketData}');
    expect(content).toContain('setBasketData={setBasketData}');
    expect(card).toContain('setBasketData(stockDetails)');
    expect(card.indexOf('setBasketData(stockDetails)')).toBeLessThan(
      card.indexOf('setStockDetails(stockDetails)'),
    );
  });

  test('shows progress while the broker preflight opens the review flow', () => {
    const card = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    expect(card).toContain('setIsCheckingReconciliation(true)');
    expect(card).toContain('await handleTradeBasket(stockDetails)');
    expect(card).toContain("text1: 'Unable to open basket'");
    expect(card).toContain("text1: 'Basket details are unavailable'");
  });

  test('partial entry retries only unfinished legs and reports progress', () => {
    const card = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    const view = read('designs/default/composites/BasketCard.js');
    expect(card).toContain("basketLifecycle?.displayStatus === 'PARTIAL_ENTRY'");
    expect(card).toContain("basketLifecycle?.reason === 'ENTRY_PARTIALLY_EXECUTED'");
    expect(card).toContain('RETRYABLE_ENTRY_STATUSES.has(status)');
    expect(card).toContain('trade_place_status: basketItem.trade_place_status');
    expect(card).toContain('Retry ${entryProgress.retryable} of ${entryProgress.total} legs');
    expect(view).toContain("text: 'Position Incomplete'");
    expect(view).toContain('Retry places only ${entryProgress.retryable} unfinished leg');
  });

  test('opens the native review modal with the correct prop and tolerates incomplete leg metadata', () => {
    const stockAdvices = read('src/components/AdviceScreenComponents/StockAdvices.js');
    const cartModal = read('src/components/AdviceScreenComponents/AddtoCartModal.js');
    const reviewModal = read('src/components/ReviewTradeModal.js');
    expect(stockAdvices).toContain('visible={openReviewTrade}');
    expect(cartModal).toContain('visible={openReviewTrade}');
    expect(stockAdvices).not.toContain('isVisible={openReviewTrade}');
    expect(cartModal).not.toContain('isVisible={openReviewTrade}');
    expect(reviewModal).toContain("fullbasketData?.[0]?.basketName");
    expect(reviewModal).not.toContain('item.tradeId.toString()');
  });

  test('keeps model-portfolio and bespoke Home visibility independent', () => {
    const home = read('src/screens/Home/HomeScreen.js');
    expect(home).toContain('...(hasActiveModelPortfolio');
    expect(home).toContain('hasActiveBespokeRecommendations &&');
    expect(home).toContain('...(!hasActiveModelPortfolio &&');
    expect(home).toContain('hasConfirmedNoModelPortfolio &&');
    expect(home).toContain('!hasActiveBespokeRecommendations &&');
    expect(home).not.toContain('const hasActiveContent =');
  });

  test('batches heavy Home carousels to keep Android input responsive', () => {
    const home = read('designs/default/screens/HomeScreen.js');
    const stockContent = read('src/components/AdviceScreenComponents/StockAdviceContent.js');
    const rebalanceContent = read('src/components/AdviceScreenComponents/RebalanceAdviceContent.js');
    const planCatalog = read('src/screens/Drawer/ModelPortfolioScreen.js');
    expect(home).toContain('maxToRenderPerBatch={1}');
    expect(stockContent).toContain("initialNumToRender={type === 'home' ? 2 : 10}");
    expect(rebalanceContent).toContain("initialNumToRender={type === 'home' ? 2 : 10}");
    expect(planCatalog).toContain("initialNumToRender={type === 'mphorizontal' ? 2 : 8}");
    expect(planCatalog).toContain("initialNumToRender={type === 'bespokehorizontal' ? 2 : 8}");
  });
});
