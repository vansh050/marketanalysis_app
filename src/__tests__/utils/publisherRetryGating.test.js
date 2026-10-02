/**
 * When the card may offer Retry, and when a holdings review is a dead end.
 *
 * prod/ankitaborn1999ghosh@gmail.com, 2026-09-18. A 7-leg Zerodha Publisher
 * basket left SWASTIVI resting OPEN (MARKET converted client-side to a LIMIT of
 * 3.68 with DAY validity; the stock moved to 3.89) and TAPARIA never accepted by
 * Kite at all. The card nevertheless flipped to "Retry Rebalance", because it
 * ranked its state off a get-repair answer taken seconds before the
 * reconciliation cases existed. Retrying would have re-bought 16 SWASTIVI that
 * the resting order could still fill. Pressing on then looped forever on a
 * holdings screen that could not clear a broker-side block.
 */
import {isPublisherLegTerminal, publisherLegStatus} from '../../utils/publisherOrderLabel';
import {holdingsReviewCanResolve} from '../../utils/accountRecoveryUx';

describe('a leg is terminal only when the broker has finished with it', () => {
  test.each([
    'COMPLETE', 'COMPLETED', 'EXECUTED', 'TRADED', 'FILLED', 'REJECTED',
    'CANCELLED', 'CANCELED', 'FAILED', 'FAILURE', 'NOT_OBSERVED', 'NOT_SENT',
    'NOT_SUBMITTED', 'HISTORY_UNAVAILABLE',
  ])('%s is terminal', status => {
    expect(isPublisherLegTerminal({orderStatus: status})).toBe(true);
    expect(isPublisherLegTerminal({orderStatus: status.toLowerCase()})).toBe(true);
  });

  test.each([
    ['the resting SWASTIVI limit', 'OPEN'],
    ['a leg Kite never confirmed', 'AWAITING_BROKER'],
    ['the spaced label form', 'AWAITING BROKER'],
    ['a queued buy', 'WAITING_FOR_SELLS'],
    ['a partial fill', 'PARTIALLY FILLED'],
    ['no status at all', ''],
    ['an unrecognised broker word', 'SOME_NEW_STATUS'],
  ])('%s is NOT terminal', (_label, status) => {
    expect(isPublisherLegTerminal({orderStatus: status})).toBe(false);
  });

  test('status is read from either field and normalised', () => {
    expect(publisherLegStatus({status: ' partially  filled '})).toBe('PARTIALLY_FILLED');
    expect(isPublisherLegTerminal(undefined)).toBe(false);
    expect(isPublisherLegTerminal({})).toBe(false);
  });

  test('the exact 2026-09-18 batch is not retryable', () => {
    const legs = [
      {symbol: 'ZEELEARN', orderStatus: 'COMPLETE'},
      {symbol: 'JPPOWER', orderStatus: 'COMPLETE'},
      {symbol: 'YESBANK', orderStatus: 'COMPLETE'},
      {symbol: 'SINDHUTRAD', orderStatus: 'COMPLETE'},
      {symbol: 'ULTRACAB', orderStatus: 'COMPLETE'},
      {symbol: 'SWASTIVI', orderStatus: 'OPEN'},
      {symbol: 'TAPARIA', orderStatus: 'AWAITING_BROKER'},
    ];
    expect(legs.some(leg => !isPublisherLegTerminal(leg))).toBe(true);
    // Once both settle, the card is free to move on.
    const settled = legs.map(leg => leg.orderStatus === 'OPEN'
      ? {...leg, orderStatus: 'CANCELLED'}
      : leg.orderStatus === 'AWAITING_BROKER'
        ? {...leg, orderStatus: 'NOT_OBSERVED'} : leg);
    expect(settled.some(leg => !isPublisherLegTerminal(leg))).toBe(false);
  });
});

describe('review_holdings is offered only when holdings can settle it', () => {
  const ownership = {
    blocked: true, state: 'ownership_conflict',
    nextAction: {code: 'review_holdings', label: 'Review portfolio holdings'},
    causes: ['broker_attribution_ambiguous'], staleDays: 0,
  };

  test('a pure ownership conflict routes to the holdings screen', () => {
    expect(holdingsReviewCanResolve(ownership)).toBe(true);
  });

  test.each([
    'execution_not_terminal',
    'broker_orders_working',
    'broker_order_status_unknown',
    'broker_order_book_unavailable',
    'broker_reconciliation_pending',
    'broker_snapshot_unavailable',
    'recovery_check_failed',
  ])('a co-occurring %s cause closes the route', cause => {
    expect(holdingsReviewCanResolve({
      ...ownership, causes: ['broker_attribution_ambiguous', cause],
    })).toBe(false);
  });

  test('a blocker stuck for days is not something the customer can edit away', () => {
    expect(holdingsReviewCanResolve({...ownership, staleDays: 12})).toBe(false);
  });

  test('any other nextAction is never a holdings route', () => {
    for (const code of ['refresh', 'reconnect', 'calculate', undefined]) {
      expect(holdingsReviewCanResolve({...ownership, nextAction: {code}})).toBe(false);
    }
    expect(holdingsReviewCanResolve(undefined)).toBe(false);
    expect(holdingsReviewCanResolve({})).toBe(false);
  });

  test('a recovery with no causes array still routes', () => {
    expect(holdingsReviewCanResolve({
      nextAction: {code: 'review_holdings'},
    })).toBe(true);
  });
});
