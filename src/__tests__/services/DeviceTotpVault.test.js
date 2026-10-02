import * as Keychain from 'react-native-keychain';
import {authenticator} from '../../utils/totp';

import {
  generateDeviceTotpFromSeed,
  normalizeDeviceTotpSeedInput,
  saveDeviceTotpSeed,
  unlockDeviceTotpLogin,
} from '../../services/DeviceTotpVault';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only'},
  ACCESS_CONTROL: {
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'biometry-or-passcode',
  },
  AUTHENTICATION_TYPE: {
    DEVICE_PASSCODE_OR_BIOMETRICS: 'passcode-or-biometrics',
  },
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
}));
jest.mock('../../utils/totp', () => ({
  authenticator: {
    check: jest.fn(),
    generate: jest.fn(),
  },
}));

const identity = {advisor: 'prod', broker: 'Kotak', userEmail: 'owner@example.com'};

describe('DeviceTotpVault protected login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticator.check.mockReturnValue(true);
    authenticator.generate.mockReturnValue('654321');
  });

  test('generates a fresh code from a pending first-connect seed', () => {
    expect(generateDeviceTotpFromSeed('AbCd 2345')).toBe('654321');
    expect(authenticator.generate).toHaveBeenCalledWith('ABCD2345');
  });

  test('accepts broker-formatted setup keys and otpauth clipboard values', () => {
    expect(normalizeDeviceTotpSeedInput('abcd-efgh 2345-67')).toBe(
      'ABCDEFGH234567',
    );
    expect(
      normalizeDeviceTotpSeedInput(
        'otpauth://totp/Broker?issuer=Broker&secret=abcd2345%3D',
      ),
    ).toBe('ABCD2345=');
  });

  test('turns Android keychain authentication failures into an actionable retry', async () => {
    Keychain.getGenericPassword.mockRejectedValue(
      new Error('Wrapped error: User not authenticated'),
    );
    await expect(unlockDeviceTotpLogin(identity)).rejects.toMatchObject({
      code: 'DEVICE_AUTHENTICATION_REQUIRED',
      message: expect.stringContaining('tap Reconnect with biometric unlock again'),
    });
  });

  test('does not generate a code from a non-Base32 pending seed', () => {
    expect(() => generateDeviceTotpFromSeed('not-a-seed!')).toThrow(
      'TOTP secret is invalid',
    );
  });

  test('stores the validated Kotak MPIN with the TOTP seed', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await saveDeviceTotpSeed(identity, 'abcd2345', '123456', {mpin: '112233'});
    const serialized = Keychain.setGenericPassword.mock.calls[0][1];
    expect(JSON.parse(serialized)).toEqual({
      version: 3,
      seed: 'ABCD2345',
      mpin: '112233',
    });
    expect(Keychain.setGenericPassword.mock.calls[0][2]).toMatchObject({
      accessible: 'device-only',
      accessControl: 'biometry-or-passcode',
    });
  });

  test('one unlock returns both a fresh TOTP and the protected MPIN', async () => {
    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-totp',
      password: JSON.stringify({version: 2, seed: 'ABCD2345', mpin: '112233'}),
    });
    await expect(unlockDeviceTotpLogin(identity)).resolves.toEqual({
      totp: '654321',
      mpin: '112233',
      pin: '',
      password: '',
      userId: '',
      twoFactor: '',
      seed: 'ABCD2345',
    });
  });

  test('keeps backward compatibility with TOTP-only version-one records', async () => {
    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-totp',
      password: 'ABCD2345',
    });
    await expect(unlockDeviceTotpLogin(identity)).resolves.toEqual({
      totp: '654321',
      mpin: '',
      pin: '',
      password: '',
      userId: '',
      twoFactor: '',
      seed: 'ABCD2345',
    });
  });

  test('rejects MPIN storage for another broker', async () => {
    await expect(
      saveDeviceTotpSeed(
        {...identity, broker: 'Groww'},
        'ABCD2345',
        '123456',
        {mpin: '112233'},
      ),
    ).rejects.toThrow('mpin cannot be stored');
  });

  test('stores and unlocks an Upstox PIN with the TOTP record', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await saveDeviceTotpSeed(
      {...identity, broker: 'Upstox'},
      'ABCD2345',
      '123456',
      {pin: '112233'},
    );
    const serialized = Keychain.setGenericPassword.mock.calls[0][1];
    expect(JSON.parse(serialized)).toEqual({
      version: 3,
      seed: 'ABCD2345',
      pin: '112233',
    });

    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-totp',
      password: serialized,
    });
    await expect(
      unlockDeviceTotpLogin({...identity, broker: 'Upstox'}),
    ).resolves.toEqual({
      totp: '654321',
      mpin: '',
      pin: '112233',
      password: '',
      userId: '',
      twoFactor: '',
      seed: 'ABCD2345',
    });
  });

  test('accepts a six-digit Dhan PIN and rejects a short one', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await expect(
      saveDeviceTotpSeed(
        {...identity, broker: 'Dhan'},
        'ABCD2345',
        '123456',
        {pin: '112233'},
      ),
    ).resolves.toBe(true);
    await expect(
      saveDeviceTotpSeed(
        {...identity, broker: 'Dhan'},
        'ABCD2345',
        '123456',
        {pin: '1234'},
      ),
    ).rejects.toThrow('saved pin is invalid');
  });

  test('stores Arihant login factors without copying the server API key', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await saveDeviceTotpSeed(
      {...identity, broker: 'Arihant Capital'},
      'ABCD2345',
      '123456',
      {userId: 'AR123', password: 'broker-password'},
    );
    const serialized = Keychain.setGenericPassword.mock.calls[0][1];
    expect(JSON.parse(serialized)).toEqual({
      version: 3,
      seed: 'ABCD2345',
      userId: 'AR123',
      password: 'broker-password',
    });
    expect(serialized).not.toContain('apiKey');
  });

  test.each([
    ['Angel One', {userId: 'A12345', mpin: '1234'}],
    ['Motilal Oswal', {password: 'broker-password', twoFactor: 'ABCDE1234F'}],
    ['Zerodha', {userId: 'AB1234', password: 'broker-password'}],
    ['Fyers', {userId: 'XY12345', pin: '1234'}],
  ])('stores only the approved %s device login factors', async (broker, factors) => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await saveDeviceTotpSeed(
      {...identity, broker},
      'ABCD2345',
      '123456',
      factors,
    );
    const record = JSON.parse(Keychain.setGenericPassword.mock.calls[0][1]);
    expect(record).toEqual({version: 3, seed: 'ABCD2345', ...factors});
    expect(record).not.toHaveProperty('apiKey');
    expect(record).not.toHaveProperty('secretKey');
  });
});
