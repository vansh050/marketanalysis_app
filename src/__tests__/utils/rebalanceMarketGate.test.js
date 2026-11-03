import {canAttemptRebalancePlacement} from '../../utils/rebalanceMarketGate';

describe('rebalance market gate', () => {
  test('temporarily enabled brokers can reach the authoritative backend outside market hours', () => {
    expect(canAttemptRebalancePlacement({broker: 'Groww', marketOpen: false})).toBe(true);
    expect(canAttemptRebalancePlacement({broker: ' groww ', marketOpen: false})).toBe(true);
    expect(canAttemptRebalancePlacement({broker: 'Kotak', marketOpen: false})).toBe(true);
    expect(canAttemptRebalancePlacement({broker: 'FYERS', marketOpen: false})).toBe(true);
  });

  test('other brokers remain client-blocked outside market hours', () => {
    expect(canAttemptRebalancePlacement({broker: 'Zerodha', marketOpen: false})).toBe(false);
    expect(canAttemptRebalancePlacement({broker: 'Angel One', marketOpen: false})).toBe(false);
  });

  test('tenant-wide after-hours configuration still opens the gate', () => {
    expect(canAttemptRebalancePlacement({
      broker: 'Zerodha',
      marketOpen: false,
      allowAfterHoursOrders: true,
    })).toBe(true);
  });

  test('all brokers may reach the backend while the market is open', () => {
    expect(canAttemptRebalancePlacement({broker: 'Zerodha', marketOpen: true})).toBe(true);
  });
});

describe('server after-hours window', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  const open = {
    afterHoursOrderBrokers: ['Zerodha'],
    afterHoursOrdersUntil: '2026-11-03T16:00:00Z',
    now,
  };

  test('opens the gate for a listed broker before the expiry', () => {
    expect(canAttemptRebalancePlacement({broker: 'zerodha', marketOpen: false, ...open})).toBe(true);
  });

  test('stays closed for an unlisted broker, after expiry, or without an expiry', () => {
    expect(canAttemptRebalancePlacement({broker: 'Angel One', marketOpen: false, ...open})).toBe(false);
    expect(canAttemptRebalancePlacement({
      broker: 'Zerodha', marketOpen: false, ...open, now: Date.parse('2026-11-03T16:00:01Z'),
    })).toBe(false);
    expect(canAttemptRebalancePlacement({
      broker: 'Zerodha', marketOpen: false, ...open, afterHoursOrdersUntil: null,
    })).toBe(false);
    expect(canAttemptRebalancePlacement({
      broker: 'Zerodha', marketOpen: false, ...open, afterHoursOrdersUntil: 'garbage',
    })).toBe(false);
  });
});
