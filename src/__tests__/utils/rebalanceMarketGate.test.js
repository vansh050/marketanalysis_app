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
