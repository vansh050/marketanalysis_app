import * as Keychain from 'react-native-keychain';
import {authenticator} from '../../utils/totp';

import {
  hasAliceBlueDeviceLogin,
  removeAliceBlueDeviceLogin,
  saveAliceBlueDeviceLogin,
  unlockAliceBlueDeviceLogin,
} from '../../services/DeviceBrokerLoginVault';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only'},
  ACCESS_CONTROL: {
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'biometry-or-passcode',
  },
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
  hasGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));
jest.mock('../../utils/totp', () => ({
  authenticator: {check: jest.fn(), generate: jest.fn()},
}));

const identity = {
  advisor: 'prod',
  broker: 'AliceBlue',
  userEmail: 'owner@example.com',
};

describe('DeviceBrokerLoginVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticator.check.mockReturnValue(true);
    authenticator.generate.mockReturnValue('654321');
  });

  test('generates the verification code locally when only the seed is supplied', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await saveAliceBlueDeviceLogin(
      identity,
      {userId: 'AB123', password: 'secret-password', totpSeed: 'ABCD2345'},
      '',
    );

    expect(authenticator.generate).toHaveBeenCalledWith('ABCD2345');
    expect(authenticator.check).toHaveBeenCalledWith('654321', 'ABCD2345');
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
  });

  test('stores AliceBlue login device-only with biometric or PIN fallback', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);
    await saveAliceBlueDeviceLogin(
      identity,
      {userId: 'AB123', password: 'secret-password', totpSeed: 'abcd 2345'},
      '123456',
    );

    const [username, serialized, options] =
      Keychain.setGenericPassword.mock.calls[0];
    expect(username).toBe('broker-login');
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      broker: 'AliceBlue',
      userId: 'AB123',
      password: 'secret-password',
      totpSeed: 'ABCD2345',
    });
    expect(options).toEqual(
      expect.objectContaining({
        accessible: 'device-only',
        accessControl: 'biometry-or-passcode',
        service:
          'com.alphaquark.broker-login.prod.aliceblue.owner_example.com',
      }),
    );
  });

  test('rejects the wrong broker and an unverified TOTP seed', async () => {
    await expect(
      saveAliceBlueDeviceLogin(
        {...identity, broker: 'Axis Securities'},
        {userId: 'AB123', password: 'secret', totpSeed: 'ABCD2345'},
        '123456',
      ),
    ).rejects.toThrow('only enabled for AliceBlue');

    authenticator.check.mockReturnValue(false);
    await expect(
      saveAliceBlueDeviceLogin(
        identity,
        {userId: 'AB123', password: 'secret', totpSeed: 'ABCD2345'},
        '123456',
      ),
    ).rejects.toThrow('verification code is invalid');
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  test('unlocks, validates, checks and removes the exact scoped record', async () => {
    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-login',
      password: JSON.stringify({
        version: 1,
        broker: 'AliceBlue',
        userId: 'AB123',
        password: 'secret',
        totpSeed: 'ABCD2345',
        accessToken: 'must-be-discarded',
      }),
    });
    Keychain.hasGenericPassword.mockResolvedValue(true);
    Keychain.resetGenericPassword.mockResolvedValue(true);

    await expect(unlockAliceBlueDeviceLogin(identity)).resolves.toEqual({
      version: 1,
      broker: 'AliceBlue',
      userId: 'AB123',
      password: 'secret',
      totpSeed: 'ABCD2345',
    });
    await expect(hasAliceBlueDeviceLogin(identity)).resolves.toBe(true);
    await expect(removeAliceBlueDeviceLogin(identity)).resolves.toBe(true);
  });
});
