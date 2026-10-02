import {
  buildUnconfirmedPublisherResults,
  classifyPublisherRecordResults,
  createZerodhaPublisherAttempt,
  getKitePublisherTag,
  isZerodhaPublisherRetryGuarded,
  parseKiteRedirectStatus,
  parseZerodhaPublisherAttempt,
  resolvePublisherSettlement,
  sanitizeKiteDiagnosticUrl,
  sanitizePublisherRecordResults,
  selectPublisherStockDetails,
} from '../../utils/publisherOutcome';

describe('publisherOutcome', () => {
  test('removes Kite credentials from diagnostic navigation URLs', () => {
    expect(sanitizeKiteDiagnosticUrl(
      'https://kite.zerodha.com/connect/login?api_key=secret&sess_id=session&type=basket',
    )).toBe('https://kite.zerodha.com/connect/login?type=basket');
    expect(sanitizeKiteDiagnosticUrl(
      'https://research.markup.club/stock-recommendation?request_token=secret&status=success&type=basket',
    )).toBe('https://research.markup.club/stock-recommendation?status=success&type=basket');
  });

  test('only detected broker orders resolve as polling success', () => {
    expect(resolvePublisherSettlement({
      reason: 'orders-detected',
      newOrders: [{orderId: '123'}],
    })).toBe('success');
    expect(resolvePublisherSettlement({
      reason: 'orders-detected',
      newOrders: [],
    })).toBe('unknown');
  });

  test('an abandoned login timeout never resolves as success', () => {
    expect(resolvePublisherSettlement({
      reason: 'timeout',
      newOrders: [],
    })).toBe('timeout');
  });

  test('a closed publisher is cancelled', () => {
    expect(resolvePublisherSettlement({reason: 'closed'})).toBe('cancelled');
    expect(resolvePublisherSettlement({reason: 'cancelled'})).toBe('cancelled');
  });

  test('parses explicit Kite redirect statuses only', () => {
    expect(parseKiteRedirectStatus(
      'https://example.com/callback?request_token=abc&status=success',
    )).toBe('success');
    expect(parseKiteRedirectStatus(
      'https://example.com/callback?status=cancelled',
    )).toBe('cancelled');
    expect(parseKiteRedirectStatus(
      'https://example.com/callback?status=cancelled&success=true',
    )).toBe('cancelled');
    expect(parseKiteRedirectStatus(
      'https://example.com/success-help?message=completed',
    )).toBeNull();
  });

  test('falls back to the mounted trade payload when AsyncStorage is missing', () => {
    const fallback = [{tradingSymbol: 'APOLLOHOSP', quantity: 5}];

    expect(selectPublisherStockDetails(null, fallback)).toBe(fallback);
    expect(selectPublisherStockDetails([], fallback)).toBe(fallback);
    expect(selectPublisherStockDetails(undefined, undefined)).toEqual([]);
  });

  test('prefers the durable payload when both recovery sources exist', () => {
    const persisted = [{tradingSymbol: 'INFY', quantity: 2}];
    const fallback = [{tradingSymbol: 'APOLLOHOSP', quantity: 5}];

    expect(selectPublisherStockDetails(persisted, fallback)).toBe(persisted);
  });

  test('uses a valid Kite tag with the same id precedence as record-orders', () => {
    expect(getKitePublisherTag({
      zerodhaTradeId: 'san15658',
      tradeId: '120459116770827',
    })).toBe('san15658');
    expect(getKitePublisherTag({
      zerodhaTradeId: 'NA',
      tradeId: '120459116770827123456789',
    })).toBe('12045911677082712345');
    expect(getKitePublisherTag({})).toBeUndefined();
  });

  test('transport failures create pending rows and never fake a rejection', () => {
    const rows = buildUnconfirmedPublisherResults(
      [{
        tradingSymbol: 'APOLLOHOSP',
        transactionType: 'BUY',
        quantity: 5,
        exchange: 'NSE',
      }],
      'Confirmation failed',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tradingSymbol: 'APOLLOHOSP',
      quantity: 5,
      orderStatus: 'pending',
      orderPlacement: 'pending',
      orderStatusMessage: 'Confirmation failed',
    });
    expect(rows[0].orderStatus).not.toBe('rejected');
  });

  test('classifies broker record-back without treating not-found as rejection', () => {
    expect(classifyPublisherRecordResults([])).toBe('empty');
    expect(classifyPublisherRecordResults([
      {orderStatus: 'order_not_found'},
    ])).toBe('not_found');
    expect(classifyPublisherRecordResults([
      {orderStatus: 'PENDING'},
    ])).toBe('pending');
    expect(classifyPublisherRecordResults([
      {orderStatus: 'COMPLETE', orderId: '260729170180681'},
    ])).toBe('recorded');
    expect(classifyPublisherRecordResults([
      {orderStatus: 'REJECTED', orderId: '260729170180682'},
    ])).toBe('recorded');
    expect(classifyPublisherRecordResults([
      {orderStatus: 'COMPLETE', orderId: '260729170180681'},
      {orderStatus: 'order_not_found'},
    ])).toBe('pending');
  });

  test('keeps broker rejections but renders order-book misses as unconfirmed', () => {
    const message = 'Check Kite before retrying';
    const rows = sanitizePublisherRecordResults([
      {symbol: 'INFY', orderStatus: 'REJECTED', orderId: 'broker-order-1'},
      {symbol: 'APOLLOHOSP', orderStatus: 'order_not_found'},
    ], message);

    expect(rows[0].orderStatus).toBe('REJECTED');
    expect(rows[1]).toMatchObject({
      symbol: 'APOLLOHOSP',
      orderStatus: 'pending',
      orderPlacement: 'pending',
      orderStatusMessage: message,
    });
  });

  test('persists an attempt and guards an immediate duplicate submission', () => {
    const stockDetails = [{
      tradingSymbol: 'APOLLOHOSP',
      transactionType: 'BUY',
      quantity: 5,
    }];
    const attempt = createZerodhaPublisherAttempt({
      stockDetails,
      userEmail: 'user@example.com',
      now: 1_000,
      attemptId: 'attempt-1',
    });
    const restored = parseZerodhaPublisherAttempt(JSON.stringify(attempt));

    expect(restored).toMatchObject({
      attemptId: 'attempt-1',
      status: 'popup_opened',
      stockDetails,
    });
    expect(isZerodhaPublisherRetryGuarded(restored, 2_000)).toBe(true);
    expect(
      isZerodhaPublisherRetryGuarded(restored, 181_001),
    ).toBe(false);
    expect(
      isZerodhaPublisherRetryGuarded({...restored, status: 'cancelled'}, 2_000),
    ).toBe(false);
  });
});
