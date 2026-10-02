/**
 * Tests for orderStatusUtils.js
 * Validates order status normalization across all broker response formats.
 */

import {
  normalizeOrderStatus,
  isOrderSuccess,
  isOrderRejected,
  isOrderPending,
  summarizeOrderStatuses,
  getOrderStatusDisplay,
} from '../../utils/orderStatusUtils';

describe('orderStatusUtils', () => {
  // ─── normalizeOrderStatus ───

  describe('normalizeOrderStatus', () => {
    test('normalizes success statuses', () => {
      const successInputs = ['complete', 'COMPLETE', 'completed', 'traded', 'filled', 'executed'];
      successInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('complete');
      });
    });

    test('normalizes pending statuses', () => {
      const pendingInputs = [
        'pending', 'PENDING', 'trigger pending', 'trigger_pending',
        'requested', 'am', 'after market', 'placed', 'ordered', 'open',
        'transit', 'after market order req received',
        'WAITING_FOR_SELLS', 'AWAITING_BROKER',
      ];
      pendingInputs.forEach(s => {
        expect(normalizeOrderStatus(s)).toBe('pending');
      });
    });

    test('normalizes rejected statuses', () => {
      const rejectedInputs = [
        'rejected', 'REJECTED', 'failed', 'failure', 'error', 'declined',
        'order_not_found', 'order not found',
      ];
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

    test('renders an empty status as "Not sent", not "Unknown"', () => {
      // A status-less row is one nothing has stamped, so the Orders screen must
      // not call it "Unknown" (prod/arulthakur, 2026-09-17: five such rows).
      expect(getOrderStatusDisplay(null)).toBe('Not sent');
      expect(getOrderStatusDisplay(undefined)).toBe('Not sent');
      expect(getOrderStatusDisplay('')).toBe('Not sent');
    });

    test('renders the sweeper verdict as "Awaiting broker confirmation"', () => {
      expect(normalizeOrderStatus('needs_reconciliation')).toBe('needs_reconciliation');
      expect(getOrderStatusDisplay('needs_reconciliation')).toBe(
        'Awaiting broker confirmation',
      );
    });
  });

  describe('summarizeOrderStatuses', () => {
    test('does not count pending/open/placed orders as executed or successful', () => {
      expect(summarizeOrderStatuses([
        {orderStatus: 'PENDING'},
        {orderStatus: 'OPEN'},
        {orderStatus: 'PLACED'},
      ])).toEqual({
        totalCount: 3,
        executedCount: 0,
        manualPlacedCount: 0,
        successCount: 0,
        pendingCount: 3,
        failureCount: 0,
        unknownCount: 0,
      });
    });

    test('keeps executed, manual, pending, and failed counts separate', () => {
      expect(summarizeOrderStatuses([
        {orderStatus: 'COMPLETE'},
        {orderStatus: 'manually_placed'},
        {orderStatus: 'PENDING'},
        {orderStatus: 'CANCELLED'},
        {orderStatus: 'something-new'},
      ])).toEqual({
        totalCount: 5,
        executedCount: 1,
        manualPlacedCount: 1,
        successCount: 2,
        pendingCount: 1,
        failureCount: 1,
        unknownCount: 1,
      });
    });
  });
});
