import {getServerBrokerReconnectState} from '../../utils/brokerStateUtils';

describe('server-authoritative broker reconnect state', () => {
  const fyersCredentials = {
    broker: 'Fyers',
    status: 'expired',
    clientCode: 'ABCDE12345-200',
    secretKey: 'encrypted-secret',
  };

  test('requires OAuth when the server has no broker slot', () => {
    expect(
      getServerBrokerReconnectState({connected_brokers: []}, 'Fyers'),
    ).toMatchObject({
      requiresOAuth: true,
      reason: 'slot_missing',
      credentialsComplete: false,
    });
  });

  test('requires OAuth for an explicitly disconnected slot even with credentials', () => {
    expect(
      getServerBrokerReconnectState(
        {
          connected_brokers: [
            {...fyersCredentials, status: 'disconnected'},
          ],
        },
        'Fyers',
      ),
    ).toMatchObject({
      requiresOAuth: true,
      reason: 'server_disconnected',
      credentialsComplete: true,
    });
  });

  test('requires OAuth when the Fyers server slot lacks reusable app credentials', () => {
    expect(
      getServerBrokerReconnectState(
        {connected_brokers: [{broker: 'Fyers', status: 'expired'}]},
        'Fyers',
      ),
    ).toMatchObject({
      requiresOAuth: true,
      reason: 'server_credentials_incomplete',
    });
  });

  test.each(['connected', 'expired', 'error', 'saved'])(
    'keeps %s Fyers slots on the host quick-reconnect path',
    status => {
      expect(
        getServerBrokerReconnectState(
          {connected_brokers: [{...fyersCredentials, status}]},
          'Fyers',
        ),
      ).toMatchObject({
        requiresOAuth: false,
        reason: 'server_reconnect_ready',
        credentialsComplete: true,
      });
    },
  );

  test('uses root credentials only when Fyers is the server-selected broker', () => {
    const user = {
      primary_broker: 'Fyers',
      connected_brokers: [{broker: 'Fyers', status: 'expired'}],
      clientCode: 'ABCDE12345-200',
      secretKey: 'encrypted-secret',
    };
    expect(getServerBrokerReconnectState(user, 'Fyers').requiresOAuth).toBe(false);

    expect(
      getServerBrokerReconnectState(
        {...user, primary_broker: 'Zerodha'},
        'Fyers',
      ).requiresOAuth,
    ).toBe(true);
  });

  test('returns diagnostic metadata without copying credential values', () => {
    const state = getServerBrokerReconnectState(
      {connected_brokers: [fyersCredentials]},
      'Fyers',
    );
    expect(JSON.stringify(state)).not.toContain('encrypted-secret');
    expect(state).toMatchObject({hasSlot: true, slotCount: 1});
  });
});
