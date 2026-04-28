/**
 * Tests for orderStatusUtils.js
 * Validates order status normalization across all broker response formats.
 */

import {
  normalizeOrderStatus,
  isOrderSuccess,
  isOrderRejected,
  isOrderPending,
  getOrderStatusDisplay,
} from '../../utils/orderStatusUtils';

describe('orderStatusUtils', () => {
  // ─── normalizeOrderStatus ───

  describe('normalizeOrderStatus', () => {
    test('normalizes success statuses', () => {
      const successInputs = ['complete', 'COMPLETE', 'completed', 'traded', 'filled', 'executed', 'placed', 'ordered', 'open', 'transit'];
      successInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('complete');
      });
    });

    test('normalizes pending statuses', () => {
      const pendingInputs = ['pending', 'PENDING', 'trigger pending', 'trigger_pending', 'requested', 'am', 'after market'];
      pendingInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('pending');
      });
    });

    test('normalizes rejected statuses', () => {
      const rejectedInputs = ['rejected', 'REJECTED', 'failed', 'failure', 'error', 'declined'];
      rejectedInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('rejected');
      });
    });

    test('normalizes cancelled statuses', () => {
      const cancelledInputs = ['cancelled', 'CANCELLED', 'canceled', 'cancelled by user', 'cancelled by system'];
      cancelledInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('cancelled');
      });
    });

    test('normalizes partial statuses', () => {
      const partialInputs = ['partially filled', 'partial', 'partially_filled'];
      partialInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('partial');
      });
    });

    test('returns unknown for unrecognized status', () => {
      expect(normalizeOrderStatus('RANDOM')).toBe('unknown');
      expect(normalizeOrderStatus('processing')).toBe('unknown');
    });

    test('returns unknown for null/undefined/non-string', () => {
      expect(normalizeOrderStatus(null)).toBe('unknown');
      expect(normalizeOrderStatus(undefined)).toBe('unknown');
      expect(normalizeOrderStatus(123)).toBe('unknown');
      expect(normalizeOrderStatus('')).toBe('unknown');
    });

    test('is case insensitive', () => {
      expect(normalizeOrderStatus('Complete')).toBe('complete');
      expect(normalizeOrderStatus('REJECTED')).toBe('rejected');
      expect(normalizeOrderStatus('Pending')).toBe('pending');
    });

    test('trims whitespace', () => {
      expect(normalizeOrderStatus('  complete  ')).toBe('complete');
    });
  });

  // ─── isOrderSuccess ───

  describe('isOrderSuccess', () => {
    test('returns true for success statuses', () => {
      expect(isOrderSuccess('complete')).toBe(true);
      expect(isOrderSuccess('TRADED')).toBe(true);
      expect(isOrderSuccess('filled')).toBe(true);
    });

    test('returns false for non-success', () => {
      expect(isOrderSuccess('rejected')).toBe(false);
      expect(isOrderSuccess('pending')).toBe(false);
    });
  });

  // ─── isOrderRejected ───

  describe('isOrderRejected', () => {
    test('returns true for rejected statuses', () => {
      expect(isOrderRejected('rejected')).toBe(true);
      expect(isOrderRejected('FAILED')).toBe(true);
    });

    test('returns true for cancelled statuses', () => {
      expect(isOrderRejected('cancelled')).toBe(true);
      expect(isOrderRejected('CANCELLED BY USER')).toBe(true);
    });

    test('returns false for success/pending', () => {
      expect(isOrderRejected('complete')).toBe(false);
      expect(isOrderRejected('pending')).toBe(false);
    });
  });

  // ─── isOrderPending ───

  describe('isOrderPending', () => {
    test('returns true for pending statuses', () => {
      expect(isOrderPending('pending')).toBe(true);
      expect(isOrderPending('TRIGGER PENDING')).toBe(true);
    });

    test('returns false for non-pending', () => {
      expect(isOrderPending('complete')).toBe(false);
      expect(isOrderPending('rejected')).toBe(false);
    });
  });

  // ─── getOrderStatusDisplay ───

  describe('getOrderStatusDisplay', () => {
    test('returns formatted display labels', () => {
      expect(getOrderStatusDisplay('complete')).toBe('Complete');
      expect(getOrderStatusDisplay('PENDING')).toBe('Pending');
      expect(getOrderStatusDisplay('rejected')).toBe('Rejected');
      expect(getOrderStatusDisplay('cancelled')).toBe('Cancelled');
      expect(getOrderStatusDisplay('partial')).toBe('Partial');
    });

    test('returns original for unknown status', () => {
      expect(getOrderStatusDisplay('CUSTOM_STATUS')).toBe('CUSTOM_STATUS');
    });

    test('returns "Unknown" for null', () => {
      expect(getOrderStatusDisplay(null)).toBe('Unknown');
    });
  });
});
