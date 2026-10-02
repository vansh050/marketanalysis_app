import fs from 'fs';
import path from 'path';

describe('mobile model-portfolio Publisher plan lifecycle', () => {
  const rebalanceSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/ModelPortfolioComponents/MPReviewTradeModal.js',
    ),
    'utf8',
  );
  const activeRebalanceSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/AdviceScreenComponents/RebalanceModal.js',
    ),
    'utf8',
  );
  const pendingOrdersSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/ModelPortfolioComponents/PendingOrdersModal.js',
    ),
    'utf8',
  );
  const initialAllocationSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/ModelPortfolioComponents/UserStrategySubscribeModal.js',
    ),
    'utf8',
  );
  const stockAdviceSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/AdviceScreenComponents/StockAdvices.js',
    ),
    'utf8',
  );
  const reviewSource = fs.readFileSync(
    path.resolve(__dirname, '../../components/ReviewZerodhaTradeModal.js'),
    'utf8',
  );
  const orderContainerSource = fs.readFileSync(
    path.resolve(__dirname, '../../screens/Home/OrderScreen.js'),
    'utf8',
  );
  const orderPresentationSource = fs.readFileSync(
    path.resolve(__dirname, '../../../designs/default/screens/OrderScreen.js'),
    'utf8',
  );
  const planCardSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/ModelPortfolioComponents/MPCard.js',
    ),
    'utf8',
  );

  test('records an intent before opening the first Kite batch', () => {
    expect(rebalanceSource).toContain('rebalance/publisher/intent');
    expect(rebalanceSource).toContain('publisherBatchDispatcherRef.current.run({');
    expect(rebalanceSource).toContain('activation_legs: activationLegs');
    expect(rebalanceSource).toContain('isPublisherActivationAcknowledged(response?.data)');
    expect(rebalanceSource).toContain('response?.data?.activationId !== activationId');
    expect(rebalanceSource).toContain('zerodhaTradeId: detail.zerodhaTradeId');
    expect(rebalanceSource).toContain("api/process-trades/execution-intent");
    expect(rebalanceSource).toContain('attemptId: publisherAttempt.attemptId');
  });

  test('captures the broker baseline before authorizing an active rebalance and safely reconciles closure', () => {
    expect(activeRebalanceSource).toContain('rebalance/publisher/cancelled');
    expect(activeRebalanceSource).toContain('await reconcileClosedPublisher()');
    expect(activeRebalanceSource.indexOf('await startOrderPolling();')).toBeLessThan(
      activeRebalanceSource.indexOf('publisherBatchDispatcherRef.current.run({'),
    );
  });

  test('treats broker NOT_OBSERVED as retryable without exposing an internal attempt id', () => {
    expect(pendingOrdersSource).toContain("replace(/_/g, ' ')");
    expect(pendingOrdersSource).toContain('Continue to order placement');
    expect(pendingOrdersSource).toContain('Review failed SELL');
    expect(pendingOrdersSource).toContain('BUY orders stay blocked until this SELL finishes');
    expect(pendingOrdersSource).not.toContain('String(attemptId).slice');
  });

  test('forwards the frozen plan through intent and result recording', () => {
    expect(rebalanceSource).toContain('plan_id: frozenPlanFields.plan_id || null');
    expect(rebalanceSource).toContain('plan_version: frozenPlanFields.plan_version ?? null');
    expect(rebalanceSource.match(/\.\.\.frozenPlanFields/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test('protects the separate first-allocation Publisher entry point', () => {
    expect(initialAllocationSource).toContain('rebalance/publisher/intent');
    expect(initialAllocationSource).toContain('publisherBatchDispatcherRef.current.run({');
    expect(initialAllocationSource).toContain('...frozenPlanFields');
    expect(initialAllocationSource).toContain('zerodhaTradeId: detail.zerodhaTradeId');
    expect(initialAllocationSource).toContain('tag: getKitePublisherTag(stock)');
    expect(initialAllocationSource).not.toContain('webViewRef.current.injectJavaScript');
  });

  test('stock and basket Publisher paths await the shared execution session', () => {
    for (const source of [stockAdviceSource, reviewSource]) {
      expect(source).toContain("lifecycle: 'popup_opened'");
      expect(source).toContain('attemptId: attempt.attemptId');
      expect(source).toContain('await axios.post(');
      expect(source).toContain('payloadMismatch');
    }
    expect(stockAdviceSource).toContain("quantity_unit: isBasket ? 'lots'");
    expect(stockAdviceSource).toContain('...customerAuthHeaders');
  });

  test('basket REST and SDK paths retain server authority and disable GTT', () => {
    expect(stockAdviceSource).toContain('Basket GTT is not available');
    expect(stockAdviceSource).toContain('basketId: payloadWithClientIds.basketId || effectiveBasketId');
    expect(stockAdviceSource).toContain(
      'const directCcxtUrl = `${server.server.baseUrl}api/process-trades/order-place`;',
    );
    expect(stockAdviceSource).not.toContain(
      '`${server.ccxtServer.baseUrl}orders/process-trade`',
    );
  });

  test('groups every identified basket leg instead of leaking a stock card', () => {
    expect(stockAdviceSource).toContain(
      'const isBasketTrade = item.Basket === true || Boolean(resolvedBasketId);',
    );
  });

  test('order history exposes pull-to-refresh through the presentation contract', () => {
    expect(orderContainerSource).toContain('refreshOrders: () => fetchTrades({pullToRefresh: true})');
    expect(orderPresentationSource).toContain('onRefresh={refreshOrders}');
    expect(orderPresentationSource).toContain('refreshing={isRefreshing}');
  });

  test('catalog active subscription also marks the plan card subscribed', () => {
    expect(planCardSource).toContain(
      "return active || Boolean(isSubscribed) ? 'active' : 'none';",
    );
  });
});
