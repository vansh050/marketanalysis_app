import { normalizeDialCode, normalizePaymentPhone } from '../../utils/paymentPhone';

describe('normalizePaymentPhone', () => {
  test('keeps national UAE digits separate from the dial code', () => {
    expect(normalizePaymentPhone('585346724', '+971')).toEqual({
      countryCode: '+971',
      nationalNumber: '585346724',
      e164: '+971585346724',
    });
  });

  test('recovers an E.164 profile phone even when the caller defaulted to India', () => {
    expect(normalizePaymentPhone('+971585346724', '+91')).toEqual({
      countryCode: '+971',
      nationalNumber: '585346724',
      e164: '+971585346724',
    });
  });

  test('recovers a legacy international phone that lost its leading plus', () => {
    expect(normalizePaymentPhone('971585346724', '+91')).toEqual({
      countryCode: '+971',
      nationalNumber: '585346724',
      e164: '+971585346724',
    });
  });

  test('does not duplicate an embedded selected calling code', () => {
    expect(normalizePaymentPhone('919876543210', 91)).toEqual({
      countryCode: '+91',
      nationalNumber: '9876543210',
      e164: '+919876543210',
    });
  });

  test('removes a domestic trunk zero before forming E.164', () => {
    expect(normalizePaymentPhone('0585346724', '+971')).toEqual({
      countryCode: '+971',
      nationalNumber: '585346724',
      e164: '+971585346724',
    });
  });

  test('preserves a significant Italian leading zero', () => {
    expect(normalizePaymentPhone('0212345678', '+39')).toEqual({
      countryCode: '+39',
      nationalNumber: '0212345678',
      e164: '+390212345678',
    });
  });

  test('returns no E.164 value for an unusable number', () => {
    expect(normalizePaymentPhone('123', '+971').e164).toBe('');
    expect(normalizePaymentPhone('', '+971').e164).toBe('');
  });
});

describe('normalizeDialCode', () => {
  test('accepts numeric and formatted calling codes', () => {
    expect(normalizeDialCode(971)).toBe('+971');
    expect(normalizeDialCode('+1 264')).toBe('+1264');
    expect(normalizeDialCode(null)).toBe('+91');
  });
});
