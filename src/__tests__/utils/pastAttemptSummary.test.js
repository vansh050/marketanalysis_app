import {isPastAttemptWithNothingBought} from '../../utils/pastAttemptSummary';

const base = {completedCount: 0, openCount: 0, orderCount: 5, retryableCount: 5};
const now = Date.parse('2026-10-07T09:00:00Z'); // 14:30 IST

describe('past attempt with nothing bought', () => {
  test('a 2 Oct all-rejected attempt viewed on 7 Oct is labelled as past', () => {
    expect(isPastAttemptWithNothingBought({...base, attemptedAt: '2026-10-02T07:42:28Z', now})).toBe(true);
  });

  test('today\'s attempt is not relabelled (IST day boundary)', () => {
    expect(isPastAttemptWithNothingBought({...base, attemptedAt: '2026-10-06T19:00:00Z', now})).toBe(false); // 00:30 IST 7 Oct
  });

  test('any fill, open order or non-failed row keeps the normal summary', () => {
    const attemptedAt = '2026-10-02T07:42:28Z';
    expect(isPastAttemptWithNothingBought({...base, attemptedAt, now, completedCount: 1})).toBe(false);
    expect(isPastAttemptWithNothingBought({...base, attemptedAt, now, openCount: 1})).toBe(false);
    expect(isPastAttemptWithNothingBought({...base, attemptedAt, now, retryableCount: 4})).toBe(false);
    expect(isPastAttemptWithNothingBought({...base, attemptedAt: null, now})).toBe(false);
  });
});
