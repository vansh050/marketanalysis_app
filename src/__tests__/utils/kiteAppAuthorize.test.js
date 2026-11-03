import {
  classifyKiteAuthorizeUrl,
  isKiteAuthorizeRequired,
  kiteAuthorizeUrl,
} from '../../utils/kiteAppAuthorize';

const err = data => ({response: {status: 400, data}});

describe('Kite app authorize', () => {
  test('only the AUTHORIZE step code triggers the WebView', () => {
    expect(isKiteAuthorizeRequired(err({error_code: 'ZERODHA_ASSISTED_AUTHORIZE_FAILED'}))).toBe(true);
    expect(isKiteAuthorizeRequired(err({error_code: 'ZERODHA_ASSISTED_TOTP_FAILED'}))).toBe(false);
    expect(isKiteAuthorizeRequired(new Error('x'))).toBe(false);
  });

  test('prefers the server URL, falls back to the typed API key, rejects junk', () => {
    const server = 'https://kite.zerodha.com/connect/login?api_key=abc123&v=3';
    expect(kiteAuthorizeUrl(err({authorize_url: server}), 'zzz')).toBe(server);
    expect(kiteAuthorizeUrl(err({}), ' 03yfqbdypz7z4aud ')).toBe(
      'https://kite.zerodha.com/connect/login?api_key=03yfqbdypz7z4aud&v=3',
    );
    expect(kiteAuthorizeUrl(err({authorize_url: 'https://evil.example/x'}), '')).toBeNull();
    expect(kiteAuthorizeUrl(err({}), 'bad key&x=1')).toBeNull();
  });

  test('classifies Kite navigation', () => {
    expect(classifyKiteAuthorizeUrl('https://kite.zerodha.com/connect/login?api_key=k&v=3')).toBeNull();
    expect(classifyKiteAuthorizeUrl('https://kite.zerodha.com/connect/authorize?sess_id=s')).toBeNull();
    expect(classifyKiteAuthorizeUrl('https://prod.alphaquark.in/cb?request_token=rt&action=login&status=success')).toBe('authorized');
    expect(classifyKiteAuthorizeUrl('https://prod.alphaquark.in/cb?status=error&error_type=x')).toBe('failed');
  });
});
