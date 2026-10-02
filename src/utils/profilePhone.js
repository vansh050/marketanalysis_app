import {parsePhoneNumberFromString} from 'libphonenumber-js/max';
import {CountryCode} from './CountryCode';

const cleanDial = value => `+${String(value || '91').replace(/\D/g, '')}`;
const countryForDial = dial => CountryCode.find(item => cleanDial(item.value) === dial);

// Profile APIs store calling code and national digits separately, as strings.
// Never remove a "91" prefix unless a country-aware parser identifies it as
// an embedded calling code: it can be part of a legitimate national number.
export const validateProfilePhone = (value, countryCode = '+91') => {
  const raw = String(value ?? '').trim();
  const dial = cleanDial(countryCode);
  const country = countryForDial(dial);
  const error = 'Enter a valid phone number for the selected country.';
  if (!raw) return {ok: false, error: 'Please enter a phone number.'};
  if (!country || !/^\+?[\d\s().-]+$/.test(raw)) return {ok: false, error};

  const parsed = parsePhoneNumberFromString(raw, {
    defaultCountry: country.code,
    extract: false,
  });
  const candidate = raw.startsWith('+') || parsed?.isValid()
    ? parsed
    : parsePhoneNumberFromString(`${dial}${raw.replace(/\D/g, '')}`);
  if (!candidate?.isValid() || !candidate.number.startsWith(dial)) {
    return {ok: false, error};
  }
  return {
    ok: true,
    countryCode: `+${candidate.countryCallingCode}`,
    nationalNumber: candidate.nationalNumber,
    e164: candidate.number,
  };
};

export const profilePhoneFields = (phoneNumber, countryCode) => {
  const raw = String(phoneNumber ?? '').trim();
  const dial = cleanDial(countryCode);
  // Explicit international numbers are authoritative when loading legacy
  // rows, including rows whose country code is missing or stale.
  const international = raw.startsWith('+') || (!countryCode && raw.replace(/\D/g, '').length > 10)
    ? parsePhoneNumberFromString(raw.startsWith('+') ? raw : `+${raw}`, {extract: false})
    : undefined;
  if (international?.isValid()) {
    return {
      countryCode: `+${international.countryCallingCode}`,
      nationalNumber: international.nationalNumber,
    };
  }
  const result = validateProfilePhone(raw, dial);
  return {
    countryCode: result.ok ? result.countryCode : dial,
    nationalNumber: result.ok ? result.nationalNumber : raw,
  };
};
