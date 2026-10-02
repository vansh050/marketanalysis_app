import {
  extractLatestModelPortfolioOrderAttempt,
  extractLatestModelPortfolioOrderResults,
  extractCurrentModelPortfolioHoldings,
} from '../../utils/modelPortfolioOrderStatus';

describe('extractLatestModelPortfolioOrderResults', () => {
  it('keeps current holdings separate from a newer proposed publisher attempt', () => {
    const payload = {data: {data: {
      user_net_pf_model: [{execDate: '2026-09-01', order_results: [{symbol: 'IDEA', quantity: 4}]}],
      publisherAttempt: {created_at: '2026-09-02', legs: [{symbol: 'YESBANK', quantity: 5}]},
    }}};
    expect(extractCurrentModelPortfolioHoldings(payload)).toEqual([{symbol: 'IDEA', quantity: 4}]);
  });
  test('falls back to advice_executed when every broker order failed', () => {
    const rejected = [{tradingSymbol: 'IDEA-EQ', orderStatus: 'REJECTED'}];
    expect(extractLatestModelPortfolioOrderResults({data: {data: {
      user_net_pf_model: null,
      advice_executed: {execDate: '2026-08-31T12:00:00Z', order_results: rejected},
    }}})).toEqual(rejected);
  });

  test('uses the newest advice attempt rather than array position', () => {
    const newest = [{tradingSymbol: 'YESBANK-EQ', orderStatus: 'REJECTED'}];
    expect(extractLatestModelPortfolioOrderResults({
      user_net_pf_model: [],
      advice_executed: [
        {execDate: '2026-08-31T12:05:00Z', order_results: newest},
        {execDate: '2026-08-31T12:00:00Z', order_results: []},
      ],
    })).toEqual(newest);
  });

  test('does not prefer an older successful holdings snapshot over a newer failed attempt', () => {
    const yesterday = [{tradingSymbol: 'ALOKINDS-EQ', orderStatus: 'COMPLETE'}];
    const today = [{tradingSymbol: 'IDEA-EQ', orderStatus: 'REJECTED'}];
    expect(extractLatestModelPortfolioOrderResults({
      user_net_pf_model: {execDate: '2026-08-31T12:00:00Z', order_results: yesterday},
      advice_executed: {execDate: '2026-09-01T06:00:00Z', order_results: today},
    })).toEqual(today);
  });

  test('publisher claims include approved legs absent from the broker book', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({
      user_net_pf_model: {execDate: '2026-08-31T12:00:00Z', order_results: []},
      publisherAttempt: {
        created_at: '2026-09-01T06:00:00Z',
        attempt_id: 'attempt-1',
        unique_id: 'unique-1',
        plan_id: 'plan-1',
        legs: [
          {symbol: 'ALOKINDS-EQ', type: 'BUY', quantity: 19},
          {symbol: 'IDEA-EQ', type: 'BUY', quantity: 4},
        ],
        orders: [
          {leg_index: 0, symbol: 'ALOKINDS-EQ', side: 'BUY', requested_quantity: 19, state: 'complete', broker_order_id: '1'},
        ],
      },
    });
    expect(attempt.orders).toEqual([
      expect.objectContaining({tradingSymbol: 'ALOKINDS-EQ', orderStatus: 'COMPLETE'}),
      expect.objectContaining({tradingSymbol: 'IDEA-EQ', orderStatus: 'NOT SENT'}),
    ]);
    expect(attempt).toEqual(expect.objectContaining({
      source: 'publisher',
      uniqueId: 'unique-1',
      planId: 'plan-1',
    }));
  });

  test('keeps an older actionable publisher attempt ahead of a newer sell-only row', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({
      advice_executed: {
        execDate: '2026-09-16T06:41:00Z',
        order_results: [
          {tradingSymbol: 'JPPOWER-EQ', transactionType: 'SELL', orderStatus: 'COMPLETE'},
          {tradingSymbol: 'SINDHUTRAD-EQ', transactionType: 'SELL', orderStatus: 'COMPLETE'},
        ],
      },
      publisherAttempt: {
        created_at: '2026-09-16T06:24:00Z',
        attempt_id: 'attempt-frozen',
        unique_id: 'unique-frozen',
        plan_id: 'plan-frozen',
        legs: [
          {tradingSymbol: 'JPPOWER-EQ', transactionType: 'SELL', quantity: 1},
          {tradingSymbol: 'SINDHUTRAD-EQ', transactionType: 'SELL', quantity: 1},
          {tradingSymbol: 'RTNPOWER-EQ', transactionType: 'BUY', quantity: 1},
          {tradingSymbol: 'SWASTIVI', transactionType: 'BUY', quantity: 18},
        ],
        orders: [
          {leg_index: 0, symbol: 'JPPOWER', side: 'SELL', requested_quantity: 1, state: 'complete', broker_order_id: '1'},
          {leg_index: 1, symbol: 'SINDHUTRAD', side: 'SELL', requested_quantity: 1, state: 'complete', broker_order_id: '2'},
          {leg_index: 2, symbol: 'RTNPOWER', side: 'BUY', requested_quantity: 1, state: 'prepared'},
          {leg_index: 3, symbol: 'SWASTIVI', side: 'BUY', requested_quantity: 18, state: 'prepared'},
        ],
      },
    });
    expect(attempt.source).toBe('publisher');
    expect(attempt.continuation).toEqual(expect.objectContaining({
      attemptId: 'attempt-frozen',
      buyLegs: [
        expect.objectContaining({tradingSymbol: 'RTNPOWER-EQ', quantity: 1}),
        expect.objectContaining({tradingSymbol: 'SWASTIVI', quantity: 18}),
      ],
    }));
    expect(attempt.orders.slice(2)).toEqual([
      expect.objectContaining({orderStatus: 'READY TO SUBMIT'}),
      expect.objectContaining({orderStatus: 'READY TO SUBMIT'}),
    ]);
  });

  // prod/testaccount 2026-09-18: TAPARIA never reached Kite, ZEELEARN did.
  // Record-back wrote advice_executed 19s after the intent's created_at with
  // only the accepted leg; newest-wins picked it and the modal said
  // "1 completed · 0 need action" while the card held at Awaiting Broker
  // Confirmation. The server attaches publisherAttempt only while it still
  // needs verification/Repair, so when present it is the current action.
  test('an attached publisher attempt outranks a newer advice row that dropped the un-sent leg', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({data: {data: {
      user_net_pf_model: {execDate: '2026-09-18T05:09:22Z', order_results: [
        {tradingSymbol: 'ZEELEARN-EQ', orderStatus: 'COMPLETE'},
      ]},
      advice_executed: {execDate: '2026-09-18T05:09:28Z', order_results: [
        {tradingSymbol: 'ZEELEARN-EQ', orderStatus: 'COMPLETE'},
      ]},
      publisherAttempt: {
        created_at: '2026-09-18T05:09:09Z',
        attempt: 'mobile-1',
        unique_id: 'u-1',
        plan_id: 'plan-1',
        state: 'recorded_partial',
        legs: [
          {tradingSymbol: 'TAPARIA', transactionType: 'BUY', quantity: 4},
          {tradingSymbol: 'ZEELEARN-EQ', transactionType: 'BUY', quantity: 5},
        ],
        orders: [
          {leg_index: 0, symbol: 'TAPARIA', transaction_type: 'BUY', requested_quantity: 4, state: 'not_observed', broker_status: 'NOT_OBSERVED'},
          {leg_index: 1, symbol: 'ZEELEARN', transaction_type: 'BUY', requested_quantity: 5, state: 'complete', broker_status: 'COMPLETE', broker_order_id: '260918150464235'},
        ],
      },
    }}});
    expect(attempt.source).toBe('publisher');
    expect(attempt.orders.map(o => [o.symbol, o.orderStatus])).toEqual([
      ['TAPARIA', 'NOT_OBSERVED'],
      ['ZEELEARN', 'COMPLETE'],
    ]);
  });

  test('without an attached publisher attempt, newest-wins is unchanged', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({data: {data: {
      user_net_pf_model: {execDate: '2026-09-18T05:09:22Z', order_results: [{tradingSymbol: 'A', orderStatus: 'COMPLETE'}]},
      advice_executed: {execDate: '2026-09-18T05:09:28Z', order_results: [{tradingSymbol: 'B', orderStatus: 'REJECTED'}]},
    }}});
    expect(attempt.source).toBe('execution');
  });

  test('a holdings snapshot is not treated as a broker execution attempt', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({data: {data: {
      user_net_pf_model: {
        uniqueId: 'holdings-only',
        execDate: '2026-09-29T06:00:00Z',
        order_results: [{symbol: 'ABC', orderStatus: 'COMPLETE'}],
      },
      subscriberExecution: {status: 'pending'},
    }}}, 'current-rebalance');

    expect(attempt).toEqual(expect.objectContaining({
      source: 'none',
      queueIdentity: null,
      orders: [],
    }));
  });

  test('scopes queue identity to the current recommendation', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({data: {data: {
      advice_executed: [
        {
          model_id: 'old-rebalance',
          uniqueId: 'old-attempt',
          execDate: '2026-09-29T07:00:00Z',
          order_results: [{symbol: 'OLD', orderStatus: 'COMPLETE'}],
        },
        {
          model_id: 'current-rebalance',
          uniqueId: 'current-attempt',
          planId: 'current-plan',
          execDate: '2026-09-29T06:00:00Z',
          order_results: [{symbol: 'NEW', orderStatus: 'OPEN'}],
        },
      ],
    }}}, 'current-rebalance');

    expect(attempt).toEqual(expect.objectContaining({
      source: 'execution',
      queueIdentity: {
        uniqueId: 'current-attempt',
        planId: 'current-plan',
        attemptId: undefined,
      },
      orders: [{symbol: 'NEW', orderStatus: 'OPEN'}],
    }));
  });

  test('does not enroll advice history from another recommendation', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({data: {data: {
      advice_executed: {
        model_id: 'old-rebalance',
        uniqueId: 'old-attempt',
        order_results: [{symbol: 'OLD', orderStatus: 'OPEN'}],
      },
    }}}, 'current-rebalance');

    expect(attempt.queueIdentity).toBeNull();
    expect(attempt.orders).toEqual([]);
  });

  test('accepts a plan id as an exact execution identity', () => {
    const attempt = extractLatestModelPortfolioOrderAttempt({data: {data: {
      advice_executed: {
        model_id: 'current-rebalance',
        planId: 'plan-only-attempt',
        order_results: [],
      },
    }}}, 'current-rebalance');

    expect(attempt.queueIdentity).toEqual({
      uniqueId: undefined,
      planId: 'plan-only-attempt',
      attemptId: undefined,
    });
  });
});
