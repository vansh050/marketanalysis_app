import {holdingsRefreshKey} from '../../utils/holdingsRefreshKey';

const base = {
  email: 'a@b.com',
  user_broker: 'Fyers',
  connect_broker_status: 'connected',
  clientCode: 'XY123',
  jwtToken: 'tok-1',
  phone_number: '9999999999',
};

describe('holdingsRefreshKey', () => {
  it('is null without a user', () => {
    expect(holdingsRefreshKey(null)).toBeNull();
    expect(holdingsRefreshKey(undefined)).toBeNull();
  });

  it('is stable across a getUser refresh that returns the same session', () => {
    const refreshed = {...base, updatedAt: 'later', phone_number: '8888888888'};
    expect(holdingsRefreshKey(refreshed)).toBe(holdingsRefreshKey(base));
  });

  it.each([
    ['broker switch', {user_broker: 'Zerodha'}],
    ['reconnect with a new token', {jwtToken: 'tok-2'}],
    ['disconnect', {connect_broker_status: 'disconnected'}],
    ['different client code', {clientCode: 'ZZ999'}],
    ['different user', {email: 'c@d.com'}],
  ])('changes on %s', (_label, change) => {
    expect(holdingsRefreshKey({...base, ...change})).not.toBe(holdingsRefreshKey(base));
  });

  it('treats missing and null fields the same', () => {
    expect(holdingsRefreshKey({...base, clientCode: null})).toBe(
      holdingsRefreshKey({...base, clientCode: undefined}),
    );
  });
});
