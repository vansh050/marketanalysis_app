/**
 * Orders tab: customer-recorded executions are not "Pending", and each order
 * shows its plan (markup, 2026-10-13).
 */
import { getOrderStatusDisplay, isOrderPending } from '../utils/orderStatusUtils';
import { getStatusColors } from '../utils/orderUtils';

describe('manually placed orders', () => {
  test('are labelled "Placed manually", not "Pending"', () => {
    expect(getOrderStatusDisplay('manually_placed')).toBe('Placed manually');
    expect(getOrderStatusDisplay('manually placed')).toBe('Placed manually');
  });

  test('use the completed colours', () => {
    expect(getStatusColors('manually_placed')).toEqual(getStatusColors('COMPLETE'));
    expect(getStatusColors('manually_placed')).not.toEqual(getStatusColors('PENDING'));
  });

  test('keep their shared-vocabulary classification (display-only change)', () => {
    expect(isOrderPending('manually_placed')).toBe(true);
  });

  test('other statuses are unchanged', () => {
    expect(getOrderStatusDisplay('PENDING')).toBe('Pending');
    expect(getOrderStatusDisplay('COMPLETE')).toBe('Complete');
  });
});
