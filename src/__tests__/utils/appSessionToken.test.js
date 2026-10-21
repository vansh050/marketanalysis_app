/**
 * App-session tokens: server-issued per-user `aq-encrypted-key`, with the
 * static client-signed token as the unconditional fallback.
 */
const mockAuth = {currentUser: null};
const mockAuthListeners = [];

jest.mock('react-native-pure-jwt', () => ({decode: jest.fn()}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => mockAuth,
  onAuthStateChanged: (_auth, cb) => {
    mockAuthListeners.push(cb);
    return () => {};
  },
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://api.test/'},
    ccxtServer: {baseUrl: 'https://ccxt.test/'},
    websocket: {baseUrl: 'https://ws.test/'},
  },
}));
jest.mock('../../utils/variantHelper', () => ({
  getTenantSubdomain: () => require('../../utils/variantHelper').__tenant.value,
  __tenant: {value: 'prod'},
}));

const Config = require('react-native-config');
const ast = require('../../utils/appSessionToken');
const {generateToken, generateStaticToken} = require('../../utils/SecurityTokenManager');
const tenantRef = require('../../utils/variantHelper').__tenant;

const KEY = Config.REACT_APP_AQ_KEYS;
const SECRET = Config.REACT_APP_AQ_SECRET;

const user = (uid = 'u1') => ({uid, getIdToken: jest.fn().mockResolvedValue(`id-${uid}`)});
const okResponse = (token = 'issued-1', expiresIn = 900) => ({
  status: 200,
  json: async () => ({success: true, token, expiresIn, kid: 'k1'}),
});
const statusResponse = status => ({status, json: async () => ({code: 'X'})});

let nowMs;
beforeEach(() => {
  jest.useFakeTimers();
  ast.__resetAppSessionTokensForTests();
  mockAuthListeners.length = 0;
  delete Config.REACT_APP_APP_SESSION_TOKENS;
  tenantRef.value = 'prod';
  mockAuth.currentUser = null;
  nowMs = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
  global.fetch = jest.fn();
});
afterEach(() => {
  ast.__resetAppSessionTokensForTests();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const isStatic = t => typeof t === 'string' && t.split('.').length === 3 && t !== 'issued-1';

describe('appSessionToken', () => {
  it('pre-login: generateToken returns the static token and never fetches', () => {
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetch success → generateToken returns the issued token (sync), with the right request', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true); // first call: static, kicks fetch
    await ast.__state.inflight;
    expect(generateToken(KEY, SECRET)).toBe('issued-1');

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/app-session/token');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect(init.headers.Authorization).toBe('Bearer id-u1');
    expect(init.headers['X-Advisor-Subdomain']).toBe('prod');
    expect(init.headers['aq-encrypted-key']).toBeUndefined();
  });

  it('only substitutes for the app key pair', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    await ast.maybeRefreshAppSessionToken();
    expect(generateToken('other-key', 'other-secret')).not.toBe('issued-1');
    expect(generateStaticToken(KEY, SECRET)).not.toBe('issued-1');
  });

  it('expiry: static once <=120 s left (device clock from receipt), refresh kicked at <180 s', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    await ast.maybeRefreshAppSessionToken();
    nowMs += (900 - 170) * 1000; // 170 s left → still usable, refresh kicked
    global.fetch.mockResolvedValue(okResponse('issued-2'));
    expect(generateToken(KEY, SECRET)).toBe('issued-1');
    await ast.__state.inflight;
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(generateToken(KEY, SECRET)).toBe('issued-2');

    nowMs += (900 - 119) * 1000; // 119 s left on issued-2
    global.fetch.mockResolvedValue(statusResponse(500));
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
  });

  it('device clock moving backwards discards the token', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    await ast.maybeRefreshAppSessionToken();
    nowMs -= 5000;
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
  });

  it.each([404, 503])('%s → no further attempt for 30 minutes', async status => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(statusResponse(status));
    await ast.maybeRefreshAppSessionToken();
    for (let i = 0; i < 5; i++) generateToken(KEY, SECRET);
    nowMs += 29 * 60 * 1000;
    generateToken(KEY, SECRET);
    await Promise.resolve();
    expect(ast.__state.inflight).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    nowMs += 2 * 60 * 1000;
    global.fetch.mockResolvedValue(okResponse());
    generateToken(KEY, SECRET);
    await ast.__state.inflight;
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('401 / network failures back off exponentially, capped at 10 minutes', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(statusResponse(401));
    await ast.maybeRefreshAppSessionToken();
    expect(ast.__state.nextAttemptAt - nowMs).toBe(15000);
    nowMs = ast.__state.nextAttemptAt;
    global.fetch.mockRejectedValue(new Error('network'));
    await ast.maybeRefreshAppSessionToken();
    expect(ast.__state.nextAttemptAt - nowMs).toBe(30000);
    for (let i = 0; i < 10; i++) {
      nowMs = ast.__state.nextAttemptAt;
      await ast.maybeRefreshAppSessionToken();
    }
    expect(ast.__state.nextAttemptAt - nowMs).toBe(10 * 60 * 1000);
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
  });

  it('sign-out clears the token; a different user never receives the previous token', async () => {
    mockAuth.currentUser = user('u1');
    const underlying = global.fetch;
    underlying.mockResolvedValue(okResponse());
    ast.initAppSessionTokens();
    await ast.maybeRefreshAppSessionToken();
    expect(generateToken(KEY, SECRET)).toBe('issued-1');

    mockAuth.currentUser = null;
    mockAuthListeners.forEach(cb => cb(null));
    expect(ast.__state.cache).toBeNull();
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);

    // user change without a listener event (race): uid check still protects
    mockAuth.currentUser = user('u1');
    await ast.maybeRefreshAppSessionToken({force: true});
    mockAuth.currentUser = user('u2');
    underlying.mockResolvedValue(okResponse('issued-u2'));
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
    await ast.__state.inflight;
    expect(generateToken(KEY, SECRET)).toBe('issued-u2');
  });

  it('a tenant switch makes the token unusable until one for the new tenant arrives', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    await ast.maybeRefreshAppSessionToken();
    tenantRef.value = 'moneyman';
    global.fetch.mockResolvedValue(okResponse('issued-mm'));
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
    await ast.__state.inflight;
    expect(generateToken(KEY, SECRET)).toBe('issued-mm');
  });

  it('kill switch REACT_APP_APP_SESSION_TOKENS=false → never fetches', async () => {
    Config.REACT_APP_APP_SESSION_TOKENS = 'false';
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    ast.initAppSessionTokens();
    for (let i = 0; i < 3; i++) expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
    await ast.maybeRefreshAppSessionToken({force: true});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('concurrent demand → exactly one fetch', async () => {
    mockAuth.currentUser = user();
    let resolve;
    global.fetch.mockImplementation(() => new Promise(r => (resolve = r)));
    for (let i = 0; i < 20; i++) generateToken(KEY, SECRET);
    const p1 = ast.maybeRefreshAppSessionToken();
    const p2 = ast.maybeRefreshAppSessionToken({force: true});
    expect(p1).toBe(p2);
    await Promise.resolve();
    await Promise.resolve();
    resolve(okResponse());
    await p1;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(generateToken(KEY, SECRET)).toBe('issued-1');
  });

  it('rejects a malformed 200 and an expiresIn too short to use', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue({status: 200, json: async () => ({success: true})});
    await ast.maybeRefreshAppSessionToken();
    nowMs = ast.__state.nextAttemptAt;
    global.fetch.mockResolvedValue(okResponse('short', 60));
    await ast.maybeRefreshAppSessionToken();
    expect(isStatic(generateToken(KEY, SECRET))).toBe(true);
  });

  it('fetch guard swaps an issued token to static for non-Node/ccxt hosts only', async () => {
    const underlying = jest.fn().mockResolvedValue(okResponse());
    global.fetch = underlying;
    mockAuth.currentUser = user();
    ast.initAppSessionTokens();
    await ast.maybeRefreshAppSessionToken();
    const issued = generateToken(KEY, SECRET);
    expect(issued).toBe('issued-1');

    await global.fetch('https://brain.test/voice/token', {headers: {'aq-encrypted-key': issued}});
    const sentElsewhere = underlying.mock.calls[underlying.mock.calls.length - 1][1];
    expect(isStatic(sentElsewhere.headers['aq-encrypted-key'])).toBe(true);

    await global.fetch('https://ccxt.test/x', {headers: {'aq-encrypted-key': issued}});
    const sentCcxt = underlying.mock.calls[underlying.mock.calls.length - 1][1];
    expect(sentCcxt.headers['aq-encrypted-key']).toBe('issued-1');

    await global.fetch('https://api.test/x', {
      headers: {'aq-encrypted-key': issued, 'X-Advisor-Subdomain': 'other'},
    });
    const sentOtherTenant = underlying.mock.calls[underlying.mock.calls.length - 1][1];
    expect(isStatic(sentOtherTenant.headers['aq-encrypted-key'])).toBe(true);
  });
});
