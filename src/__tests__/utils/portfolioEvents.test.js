/**
 * Tests for portfolioEvents.js
 * Matches: Web src/__tests__/utils/portfolioEvents.test.js
 * Validates EventEmitter pattern for cross-component communication.
 */

import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';

describe('portfolioEvents', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    portfolioEvents.off();
  });

  // ─── PORTFOLIO_EVENTS constants ───

  describe('PORTFOLIO_EVENTS', () => {
    test('has all expected event types', () => {
      expect(PORTFOLIO_EVENTS.HOLDINGS_REFRESH).toBe('HOLDINGS_REFRESH');
      expect(PORTFOLIO_EVENTS.REBALANCE_EXECUTED).toBe('REBALANCE_EXECUTED');
      expect(PORTFOLIO_EVENTS.DISTRIBUTION_REFRESH).toBe('DISTRIBUTION_REFRESH');
      expect(PORTFOLIO_EVENTS.BROKER_CONNECTED).toBe('BROKER_CONNECTED');
      expect(PORTFOLIO_EVENTS.BROKER_DISCONNECTED).toBe('BROKER_DISCONNECTED');
      expect(PORTFOLIO_EVENTS.ORDER_PLACED).toBe('ORDER_PLACED');
      expect(PORTFOLIO_EVENTS.ORDER_STATUS_UPDATED).toBe('ORDER_STATUS_UPDATED');
    });

    test('has 7 event types', () => {
      expect(Object.keys(PORTFOLIO_EVENTS)).toHaveLength(7);
    });
  });

  // ─── on / emit ───

  describe('on and emit', () => {
    test('listener receives emitted data', () => {
      const callback = jest.fn();
      portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, callback);

      const data = {userEmail: 'test@test.com', modelName: 'Growth'};
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, data);

      expect(callback).toHaveBeenCalledWith(data);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('multiple listeners for same event', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, cb1);
      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, cb2);

      portfolioEvents.emit(PORTFOLIO_EVENTS.ORDER_PLACED, {orderId: '123'});

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    test('listeners for different events are independent', () => {
      const holdingsCallback = jest.fn();
      const orderCallback = jest.fn();

      portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, holdingsCallback);
      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, orderCallback);

      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {});

      expect(holdingsCallback).toHaveBeenCalledTimes(1);
      expect(orderCallback).not.toHaveBeenCalled();
    });

    test('emit with no listeners does not throw', () => {
      expect(() => {
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {});
      }).not.toThrow();
    });
  });

  // ─── unsubscribe ───

  describe('unsubscribe', () => {
    test('on() returns unsubscribe function', () => {
      const callback = jest.fn();
      const unsub = portfolioEvents.on(PORTFOLIO_EVENTS.BROKER_CONNECTED, callback);

      portfolioEvents.emit(PORTFOLIO_EVENTS.BROKER_CONNECTED, {});
      expect(callback).toHaveBeenCalledTimes(1);

      unsub(); // unsubscribe

      portfolioEvents.emit(PORTFOLIO_EVENTS.BROKER_CONNECTED, {});
      expect(callback).toHaveBeenCalledTimes(1); // still 1
    });

    test('unsubscribe only removes specific listener', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      const unsub1 = portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, cb1);
      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, cb2);

      unsub1();
      portfolioEvents.emit(PORTFOLIO_EVENTS.ORDER_PLACED, {});

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // ─── off ───

  describe('off', () => {
    test('removes all listeners for a specific event', () => {
      const callback = jest.fn();
      portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, callback);

      portfolioEvents.off(PORTFOLIO_EVENTS.HOLDINGS_REFRESH);
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {});

      expect(callback).not.toHaveBeenCalled();
    });

    test('off() with no args clears all listeners', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, cb1);
      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, cb2);

      portfolioEvents.off();

      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {});
      portfolioEvents.emit(PORTFOLIO_EVENTS.ORDER_PLACED, {});

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ─── Error handling ───

  describe('error handling in listeners', () => {
    test('catching error in one listener does not break others', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const badCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodCallback = jest.fn();

      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, badCallback);
      portfolioEvents.on(PORTFOLIO_EVENTS.ORDER_PLACED, goodCallback);

      portfolioEvents.emit(PORTFOLIO_EVENTS.ORDER_PLACED, {});

      expect(badCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled(); // still called despite error above
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
