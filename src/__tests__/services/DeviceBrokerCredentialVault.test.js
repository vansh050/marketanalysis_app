import * as Keychain from 'react-native-keychain';

import {
  findPersistedBrokerEntry,
  hasPersistedBrokerCredentials,
  removePersistedBrokerCredentials,
  savePersistedBrokerCredentials,
  supportsDeviceBrokerCredentialVault,
  unlockPersistedBrokerCredentials,
} from '../../services/DeviceBrokerCredentialVault';

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

const identity = {
  advisor: 'Alpha B2B',
  broker: 'Angel One',
  userEmail: 'Customer+Trade@example.com',
};

describe('DeviceBrokerCredentialVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('supports only the reviewed reusable-credential brokers', () => {
    expect(supportsDeviceBrokerCredentialVault('Angel One')).toBe(true);
    expect(supportsDeviceBrokerCredentialVault('DefinEdge Securities')).toBe(true);
    expect(supportsDeviceBrokerCredentialVault('Zerodha')).toBe(false);
    expect(supportsDeviceBrokerCredentialVault('Dhan')).toBe(false);
  });

  test('stores only allowlisted server-encrypted fields in device-only secure storage', async () => {
    Keychain.setGenericPassword.mockResolvedValue(true);

    await savePersistedBrokerCredentials(identity, {
      broker: 'Angel One',
      apiKey: 'encrypted-api-key',
      secretKey: 'encrypted-secret-key',
      clientCode: 'AB1234',
      password: 'must-not-be-stored',
      mpin: '1234',
      otp: '999999',
      jwtToken: 'broker-session',
      accessToken: 'oauth-session',
    });

    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
    const [username, serialized, options] =
      Keychain.setGenericPassword.mock.calls[0];
    expect(username).toBe('broker-api-credentials');
    expect(JSON.parse(serialized)).toEqual({
      broker: 'Angel One',
      apiKey: 'encrypted-api-key',
      clientCode: 'AB1234',
    });
    expect(serialized).not.toContain('encrypted-secret-key');
    expect(serialized).not.toContain('must-not-be-stored');
    expect(serialized).not.toContain('broker-session');
    expect(options).toEqual(
      expect.objectContaining({
        service:
          'com.alphaquark.broker-credentials.alpha_b2b.angel_one.customer_trade_example.com',
        accessible: 'device-only',
        accessControl: 'biometry-or-passcode',
      }),
    );
  });

  test('rejects unsupported brokers and mismatched records', async () => {
    await expect(
      savePersistedBrokerCredentials(
        {...identity, broker: 'Zerodha'},
        {broker: 'Zerodha', apiKey: 'x'},
      ),
    ).rejects.toThrow('does not support');
    await expect(
      savePersistedBrokerCredentials(identity, {
        broker: 'Upstox',
        apiKey: 'x',
      }),
    ).rejects.toThrow('does not support');
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  test('biometric unlock revalidates and strips non-allowlisted fields', async () => {
    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-api-credentials',
      password: JSON.stringify({
        broker: 'Angel One',
        apiKey: 'encrypted-api-key',
        password: 'injected-value',
      }),
    });

    await expect(unlockPersistedBrokerCredentials(identity)).resolves.toEqual({
      broker: 'Angel One',
      apiKey: 'encrypted-api-key',
    });
  });

  test('does not expose a damaged or empty vault record', async () => {
    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-api-credentials',
      password: '{damaged',
    });
    await expect(unlockPersistedBrokerCredentials(identity)).rejects.toThrow(
      'damaged',
    );

    Keychain.getGenericPassword.mockResolvedValue({
      username: 'broker-api-credentials',
      password: JSON.stringify({broker: 'Angel One', otp: '123456'}),
    });
    await expect(unlockPersistedBrokerCredentials(identity)).rejects.toThrow(
      'No validated reusable API credentials',
    );
  });

  test('uses the same scoped service for presence checks and removal', async () => {
    Keychain.hasGenericPassword.mockResolvedValue(true);
    Keychain.resetGenericPassword.mockResolvedValue(true);

    await expect(hasPersistedBrokerCredentials(identity)).resolves.toBe(true);
    await expect(removePersistedBrokerCredentials(identity)).resolves.toBe(true);

    const expected = {
      service:
        'com.alphaquark.broker-credentials.alpha_b2b.angel_one.customer_trade_example.com',
    };
    expect(Keychain.hasGenericPassword).toHaveBeenCalledWith(expected);
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith(expected);
  });

  test('finds only the exact broker record', () => {
    const user = {
      connected_brokers: [
        {broker: 'Upstox', apiKey: 'upstox'},
        {broker: 'Angel One', apiKey: 'angel'},
      ],
    };
    expect(findPersistedBrokerEntry(user, 'Angel One')).toEqual({
      broker: 'Angel One',
      apiKey: 'angel',
    });
    expect(findPersistedBrokerEntry(user, 'Angel')).toBeNull();
  });
});
