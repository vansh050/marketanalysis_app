/**
 * Canonical phone shaping for payment-order APIs.
 *
 * Payment backends expect countryCode and mobileNumber separately, then build
 * the E.164 customer phone sent to Cashfree/PayU/Razorpay. Profile data is not
 * consistent: phone_number may be national digits, E.164, or E.164 without a
 * leading plus. Normalize all three shapes before creating an order.
 *
 * See docs/MODEL_PORTFOLIO_ARCHITECTURE.md, "International payment phones".
 */

import { CountryCode } from './CountryCode';

const DEFAULT_DIAL_CODE = '+91';
const TRUNK_ZERO_DIAL_CODES = new Set(['91', '971']);

const dialCodeDigits = value => String(value || '').replace(/\D/g, '');

const KNOWN_DIAL_CODES = Array.from(
  new Set(CountryCode.map(item => dialCodeDigits(item.value)).filter(Boolean)),
).sort((left, right) => right.length - left.length);

export const normalizeDialCode = value => {
  const digits = dialCodeDigits(value);
  return digits ? `+${digits}` : DEFAULT_DIAL_CODE;
};

const detectEmbeddedDialCode = digits => {
  if (digits.length <= 10) {
    return null;
  }

  return KNOWN_DIAL_CODES.find(code => {
    const nationalLength = digits.length - code.length;
    return digits.startsWith(code) && nationalLength >= 6 && nationalLength <= 15;
  }) || null;
};

export const normalizePaymentPhone = (phoneNumber, countryCode) => {
  const raw = String(phoneNumber || '').trim();
  const digits = raw.replace(/\D/g, '');
  let dialDigits = dialCodeDigits(countryCode) || dialCodeDigits(DEFAULT_DIAL_CODE);
  let nationalNumber = digits;

  if (!digits) {
    return {
      countryCode: `+${dialDigits}`,
      nationalNumber: '',
      e164: '',
    };
  }

  // A leading plus is authoritative. For legacy profile rows that lost the
  // plus, a >10-digit value can still be recognized by a known calling code.
  const embeddedDial = raw.startsWith('+')
    ? KNOWN_DIAL_CODES.find(code => digits.startsWith(code))
    : detectEmbeddedDialCode(digits);

  if (embeddedDial) {
    dialDigits = embeddedDial;
    nationalNumber = digits.slice(embeddedDial.length);
  } else if (digits.startsWith(dialDigits) && digits.length - dialDigits.length >= 6) {
    nationalNumber = digits.slice(dialDigits.length);
  }

  // India/UAE users commonly include the domestic trunk prefix. Do not do
  // this globally: a leading zero remains significant in some E.164 plans
  // (notably Italian fixed-line numbers).
  if (TRUNK_ZERO_DIAL_CODES.has(dialDigits)) {
    nationalNumber = nationalNumber.replace(/^0+/, '');
  }

  const e164Digits = `${dialDigits}${nationalNumber}`;
  const e164 = e164Digits.length >= 8 && e164Digits.length <= 15
    ? `+${e164Digits}`
    : '';

  return {
    countryCode: `+${dialDigits}`,
    nationalNumber,
    e164,
  };
};

export default normalizePaymentPhone;
