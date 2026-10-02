import {normalizeKraDob} from '../../utils/normalizeKraDob';

describe('normalizeKraDob', () => {
  test('converts a legacy Indian-midnight ISO value to the intended DOB', () => {
    expect(normalizeKraDob('2003-07-04T18:30:00.000Z')).toBe('2003-07-05');
  });

  test('keeps an existing date-only value unchanged', () => {
    expect(normalizeKraDob('2003-07-05')).toBe('2003-07-05');
  });

  test('normalizes the displayed Indian DD/MM/YYYY format', () => {
    expect(normalizeKraDob('05/07/2003')).toBe('2003-07-05');
  });

  test('preserves the local calendar day selected in the date picker', () => {
    expect(normalizeKraDob(new Date(2003, 6, 5, 12, 0, 0))).toBe('2003-07-05');
  });

  test('rejects impossible and unparseable dates', () => {
    expect(normalizeKraDob('31/02/2003')).toBe('');
    expect(normalizeKraDob('not-a-date')).toBe('');
  });
});
