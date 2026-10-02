import {resolveModelPortfolioHoldings} from '../../utils/modelPortfolioHoldings';

const execution = (execDate, quantity = 8, broker = 'DefinEdge Securities') => ({
  execDate,
  user_broker: broker,
  order_results: [{symbol: 'RADICO', quantity, averagePrice: 1970}],
});

describe('resolveModelPortfolioHoldings', () => {
  test('uses CCXT when its current-broker execution contains holdings', () => {
    const ccxt = execution('2026-08-27T09:23:38.391Z');
    const mirrored = execution('2026-08-27T09:23:38.391Z');

    expect(
      resolveModelPortfolioHoldings(
        {user_net_pf_model: [ccxt]},
        {user_net_pf_model: [mirrored]},
      ),
    ).toMatchObject({
      executions: [ccxt],
      source: 'ccxt',
      ccxtHasHoldings: true,
      subscriptionHasHoldings: true,
      isStaleBrokerData: false,
    });
  });

  test('falls back when CCXT returns an empty array during reconciliation', () => {
    const mirrored = execution('2026-08-27T09:23:38.391Z');

    expect(
      resolveModelPortfolioHoldings(
        {user_net_pf_model: []},
        {
          user_broker: 'DefinEdge Securities',
          user_net_pf_model: [mirrored],
        },
        'DefinEdge Securities',
      ),
    ).toMatchObject({
      executions: [mirrored],
      source: 'subscription',
      ccxtHasHoldings: false,
      subscriptionHasHoldings: true,
      isStaleBrokerData: false,
    });
  });

  test('marks fallback data stale only when it belongs to another broker', () => {
    const oldBrokerExecution = execution(
      '2026-08-27T09:23:38.391Z',
      8,
      'Zerodha',
    );

    expect(
      resolveModelPortfolioHoldings(
        {user_net_pf_model: []},
        {user_broker: 'Zerodha', user_net_pf_model: [oldBrokerExecution]},
        'DefinEdge Securities',
      ).isStaleBrokerData,
    ).toBe(true);
  });

  test('ignores a leading empty snapshot and keeps valid CCXT holdings', () => {
    const held = execution('2026-08-27T09:23:38.391Z');
    const empty = {user_edit_id: 'legacy-placeholder', order_results: []};

    const result = resolveModelPortfolioHoldings(
      {user_net_pf_model: [empty, held]},
      {user_net_pf_model: []},
    );

    expect(result.source).toBe('ccxt');
    expect(result.executions).toEqual([empty, held]);
    expect(result.ccxtHasHoldings).toBe(true);
  });

  test('keeps a newer authoritative empty CCXT snapshot instead of stale mirrored holdings', () => {
    const held = execution('2026-09-28T09:23:38.391Z', 1, 'Zerodha');
    const exited = {
      execDate: '2026-09-29T05:08:06.000Z',
      user_broker: 'Zerodha',
      snapshot_writer: 'broker_reconciliation',
      order_results: [],
    };

    expect(
      resolveModelPortfolioHoldings(
        {user_net_pf_model: [held, exited]},
        {user_broker: 'Zerodha', user_net_pf_model: [held]},
        'Zerodha',
      ),
    ).toMatchObject({
      executions: [held, exited],
      source: 'ccxt',
      ccxtHasSnapshot: true,
      ccxtHasHoldings: false,
      subscriptionHasHoldings: true,
      isStaleBrokerData: false,
    });
  });

  test('preserves an empty state when neither source has executed holdings', () => {
    expect(
      resolveModelPortfolioHoldings(
        {user_net_pf_model: []},
        {user_net_pf_model: []},
      ),
    ).toMatchObject({
      executions: [],
      source: 'ccxt',
      ccxtHasHoldings: false,
      subscriptionHasHoldings: false,
      isStaleBrokerData: false,
    });
  });
});
