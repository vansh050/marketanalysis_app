/**
 * authTokenInterceptor × app-session tokens: an issued token that gets a 401
 * is retried ONCE with the static token, only when the issued token was
 * actually sent; issued tokens never reach other hosts.
 */
const mockReq = [];
const mockResp = [];
const mockAxiosCall = jest.fn();

jest.mock('react-native-pure-jwt', () => ({decode: jest.fn()}));
jest.mock('react-native-device-info', () => ({
  getVersion: () => '5.1.3',
  getBuildNumber: () => '412',
}));
jest.mock('@react-native-firebase/auth', () => ({getAuth: () => ({currentUser: null})}));
jest.mock('../../components/EventEmitter', () => ({__esModule: true, default: {emit: jest.fn()}}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {server: {baseUrl: 'https://api.test/'}, ccxtServer: {baseUrl: 'https://ccxt.test/'}},
}));
jest.mock('axios', () => {
  const fn = (...args) => mockAxiosCall(...args);
  fn.interceptors = {
    request: {use: h => mockReq.push(h)},
    response: {use: (ok, err) => mockResp.push(err)},
  };
  return {__esModule: true, default: fn};
});
jest.mock('../../utils/appSessionToken', () => {
  const actual = jest.requireActual('../../utils/appSessionToken');
  return {
    ...actual,
    isIssuedAppSessionToken: v => v === 'ISSUED',
    tenantForIssuedToken: v => (v === 'ISSUED' ? 'prod' : null),
    issuedTokenAllowedFor: (url, v, reqTenant) =>
      (url.startsWith('https://api.test/') || url.startsWith('https://ccxt.test/')) &&
      (!reqTenant || reqTenant === 'prod'),
    getStaticToken: () => 'STATIC',
    clearAppSessionToken: jest.fn(),
  };
});

const ast = require('../../utils/appSessionToken');
const {
  installAuthTokenInterceptor,
  shouldRetryWithStatic,
  isTokenRejection401,
} = require('../../utils/authTokenInterceptor');

beforeAll(() => installAuthTokenInterceptor());
beforeEach(() => {
  mockAxiosCall.mockReset();
  ast.clearAppSessionToken.mockClear();
});

const request = cfg => mockReq[0](cfg);
const onError = err => mockResp[0](err);
const err401 = (config, data = {}) => ({config, response: {status: 401, data}});

describe('request policy', () => {
  it('marks Node/ccxt requests that carry the issued token and adds X-App-Version', async () => {
    const cfg = await request({url: 'https://api.test/api/x', headers: {'aq-encrypted-key': 'ISSUED'}});
    expect(cfg.__aqIssuedToken).toBe('ISSUED');
    expect(cfg.headers['aq-encrypted-key']).toBe('ISSUED');
    expect(cfg.headers['X-App-Version']).toBe('5.1.3+412');
  });

  it('swaps the issued token to static for other hosts, and adds no header there', async () => {
    const cfg = await request({url: 'https://brain.test/voice/token', headers: {'aq-encrypted-key': 'ISSUED'}});
    expect(cfg.headers['aq-encrypted-key']).toBe('STATIC');
    expect(cfg.__aqIssuedToken).toBeUndefined();
    expect(cfg.headers['X-App-Version']).toBeUndefined();
  });

  it('swaps to static when the request names a different tenant', async () => {
    const cfg = await request({
      url: 'https://api.test/api/x',
      headers: {'aq-encrypted-key': 'ISSUED', 'X-Advisor-Subdomain': 'moneyman'},
    });
    expect(cfg.headers['aq-encrypted-key']).toBe('STATIC');
    expect(cfg.__aqIssuedToken).toBeUndefined();
  });

  it('leaves a static token untouched', async () => {
    const cfg = await request({url: 'https://api.test/api/x', headers: {'aq-encrypted-key': 'some.static.jwt'}});
    expect(cfg.headers['aq-encrypted-key']).toBe('some.static.jwt');
    expect(cfg.__aqIssuedToken).toBeUndefined();
  });
});

describe('401 fallback to static', () => {
  it('retries once with the static token when the issued token was sent', async () => {
    mockAxiosCall.mockResolvedValue({status: 200, data: 'ok'});
    const cfg = await request({url: 'https://api.test/api/x', method: 'get', headers: {'aq-encrypted-key': 'ISSUED'}});
    const res = await onError(err401(cfg));
    expect(res.data).toBe('ok');
    expect(mockAxiosCall).toHaveBeenCalledTimes(1);
    const retried = mockAxiosCall.mock.calls[0][0];
    expect(retried.headers['aq-encrypted-key']).toBe('STATIC');
    expect(retried.__aqStaticRetried).toBe(true);
    expect(ast.clearAppSessionToken).toHaveBeenCalled();
  });

  it('does not retry when the static token was sent', async () => {
    const cfg = await request({url: 'https://api.test/api/x', method: 'get', headers: {'aq-encrypted-key': 'some.static.jwt'}});
    // customer-API GET 401 path may try a firebase refresh; no user → no replay
    await expect(onError(err401(cfg))).rejects.toBeDefined();
    expect(mockAxiosCall).not.toHaveBeenCalled();
  });

  it('never loops: a second 401 after the static retry is passed through', async () => {
    const cfg = await request({url: 'https://ccxt.test/x', method: 'get', headers: {'aq-encrypted-key': 'ISSUED'}});
    mockAxiosCall.mockImplementation(async retriedCfg => {
      const again = await request(retriedCfg);
      return onError(err401(again));
    });
    await expect(onError(err401(cfg))).rejects.toBeDefined();
    expect(mockAxiosCall).toHaveBeenCalledTimes(1);
  });

  it('POST is replayed only on proof the token itself was rejected', async () => {
    const cfg = await request({url: 'https://ccxt.test/order', method: 'post', headers: {'aq-encrypted-key': 'ISSUED'}});
    expect(shouldRetryWithStatic(err401(cfg, {error: 'Broker session expired'}))).toBe(false);
    expect(shouldRetryWithStatic(err401(cfg, {error: 'Invalid token', status: 1}))).toBe(true);
    expect(shouldRetryWithStatic(err401(cfg, {success: false, message: 'Token has expired'}))).toBe(true);
    expect(shouldRetryWithStatic(err401(cfg, {code: 'APP_SESSION_INVALID'}))).toBe(true);
    expect(isTokenRejection401({response: {status: 403, data: {error: 'Invalid token'}}})).toBe(false);
  });

  it('non-401 errors are not replayed', () => {
    expect(
      shouldRetryWithStatic({config: {__aqIssuedToken: 'ISSUED', method: 'get'}, response: {status: 500}}),
    ).toBe(false);
  });
});
