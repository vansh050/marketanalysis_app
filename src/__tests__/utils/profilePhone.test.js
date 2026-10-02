import {profilePhoneFields, validateProfilePhone} from '../../utils/profilePhone';

describe('profile phone saving and reopening', () => {
  test.each([
    ['33123456', '+974', '33123456'],
    ['91234567', '+65', '91234567'],
    ['0585346724', '+971', '585346724'],
    ['07400123456', '+44', '7400123456'],
    ['9123456789', '+91', '9123456789'],
    ['919198765432', '+91', '9198765432'],
    ['(202) 555-0123', '+1', '2025550123'],
    ['02 1234 5678', '+39', '0212345678'],
    ['+974 3312 3456', '+974', '33123456'],
  ])('normalizes %s with %s without losing national digits', (input, dial, nationalNumber) => {
    const result = validateProfilePhone(input, dial);
    expect(result).toMatchObject({ok: true, countryCode: dial, nationalNumber});
    expect(profilePhoneFields(result.nationalNumber, result.countryCode)).toEqual({
      countryCode: dial, nationalNumber,
    });
  });

  test.each([
    ['', '+974'], ['1234567', '+974'], ['331234567', '+974'],
    ['12345678', '+974'], ['987654321', '+91'], ['202555012', '+1'],
    ['call 33123456', '+974'], ['33123456 ext 12', '+974'],
    ['+442079460018', '+974'], ['1234567890123456', '+974'],
    ['33123456', '+999'], ['+33123456', '+974'],
  ])('rejects invalid or mismatched input %s / %s', (input, dial) => {
    expect(validateProfilePhone(input, dial).ok).toBe(false);
  });

  test.each([
    ['33123456', 974, '+974', '33123456'],
    ['+97433123456', undefined, '+974', '33123456'],
    ['+97433123456', 91, '+974', '33123456'],
    ['97433123456', 974, '+974', '33123456'],
    ['97433123456', undefined, '+974', '33123456'],
    ['9123456789', undefined, '+91', '9123456789'],
    ['9198765432', 91, '+91', '9198765432'],
    ['919198765432', 91, '+91', '9198765432'],
    ['0212345678', '39', '+39', '0212345678'],
    [null, undefined, '+91', ''],
  ])('restores stored %s / %s', (input, storedDial, countryCode, nationalNumber) => {
    expect(profilePhoneFields(input, storedDial)).toEqual({countryCode, nationalNumber});
  });

  test('retains invalid stored input for correction instead of truncating it', () => {
    expect(profilePhoneFields('91123', 91)).toEqual({countryCode: '+91', nationalNumber: '91123'});
  });
});
