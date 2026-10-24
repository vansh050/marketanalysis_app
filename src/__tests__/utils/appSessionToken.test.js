/**
 * App-session tokens: server-issued per-user `aq-encrypted-key`. The static
 * client-signed token is for signed-out requests only; a signed-in request
 * to Node/ccxt waits for the issued token instead of falling back.
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
    for (let i = 0; i < 20 && !resolve; i++) await Promise.resolve();
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

  it('ensureIssuedAppSessionToken: null when signed out, waits for the fetch when signed in', async () => {
    expect(await ast.ensureIssuedAppSessionToken()).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(okResponse());
    expect(await ast.ensureIssuedAppSessionToken()).toBe('issued-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('ensureIssuedAppSessionToken does not force past a back-off', async () => {
    mockAuth.currentUser = user();
    global.fetch.mockResolvedValue(statusResponse(503));
    expect(await ast.ensureIssuedAppSessionToken()).toBeNull();
    expect(await ast.ensureIssuedAppSessionToken()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('isOwnStaticToken recognises only the app key pair static token', () => {
    expect(ast.isOwnStaticToken(generateStaticToken(KEY, SECRET))).toBe(true);
    expect(ast.isOwnStaticToken(generateStaticToken('other-key', SECRET))).toBe(false);
    expect(ast.isOwnStaticToken('not-a-jwt')).toBe(false);
    expect(ast.isOwnStaticToken(null)).toBe(false);
  });

  it('fetch guard: a signed-in Node/ccxt request leaves with the issued token, not the static one', async () => {
    const underlying = jest.fn().mockResolvedValue(okResponse());
    global.fetch = underlying;
    ast.initAppSessionTokens();
    const staticToken = generateStaticToken(KEY, SECRET);

    // Signed out: the static (pre-login) token goes unchanged.
    await global.fetch('https://api.test/api/admin/frontend-config', {headers: {'aq-encrypted-key': staticToken}});
    expect(underlying.mock.calls[0][1].headers['aq-encrypted-key']).toBe(staticToken);

    // Signed in, no token cached yet: the request waits for one.
    mockAuth.currentUser = user();
    await global.fetch('https://ccxt.test/x', {headers: {'aq-encrypted-key': staticToken}});
    const last = underlying.mock.calls[underlying.mock.calls.length - 1];
    expect(last[0]).toBe('https://ccxt.test/x');
    expect(last[1].headers['aq-encrypted-key']).toBe('issued-1');

    // Another host keeps the static token.
    await global.fetch('https://brain.test/voice/token', {headers: {'aq-encrypted-key': staticToken}});
    const brain = underlying.mock.calls[underlying.mock.calls.length - 1][1];
    expect(brain.headers['aq-encrypted-key']).toBe(staticToken);
  });

  it('fetch guard: a static token signed for another key pair is left alone', async () => {
    const underlying = jest.fn().mockResolvedValue(okResponse());
    global.fetch = underlying;
    ast.initAppSessionTokens();
    mockAuth.currentUser = user();
    const partner = generateStaticToken('partner-key', SECRET);
    await global.fetch('https://api.test/x', {headers: {'aq-encrypted-key': partner}});
    expect(underlying).toHaveBeenCalledTimes(1);
    expect(underlying.mock.calls[0][1].headers['aq-encrypted-key']).toBe(partner);
  });

  describe('signed in, no issued token: never the static token on a private route', () => {
    const Toast = require('react-native-toast-message');
    beforeEach(() => {
      Config.REACT_APP_AQ_KEYS_PUBLIC = 'true';
    });
    afterEach(() => {
      delete Config.REACT_APP_AQ_KEYS_PUBLIC;
    });
    const staticToken = () => generateStaticToken(KEY, SECRET);
    const setup = responses => {
      const underlying = jest.fn();
      responses.forEach(r => underlying.mockResolvedValueOnce(r));
      underlying.mockResolvedValue(okResponse());
      global.fetch = underlying;
      ast.initAppSessionTokens();
      mockAuth.currentUser = user();
      Toast.show.mockClear();
      return underlying;
    };
    const sentTo = (underlying, url) => underlying.mock.calls.filter(c => c[0] === url);
    const tokenCalls = underlying =>
      underlying.mock.calls.filter(c => String(c[0]).endsWith('api/app-session/token')).length;

    it('rejects with APP_SESSION_REQUIRED and shows a toast; nothing leaves', async () => {
      const underlying = setup([statusResponse(500), statusResponse(500)]);
      await expect(
        global.fetch('https://api.test/api/user/getUser/a@b.c', {headers: {'aq-encrypted-key': staticToken()}}),
      ).rejects.toMatchObject({code: 'APP_SESSION_REQUIRED', isAppSessionRequired: true});
      expect(sentTo(underlying, 'https://api.test/api/user/getUser/a@b.c')).toHaveLength(0);
      expect(Toast.show).toHaveBeenCalledTimes(1);
    });

    it('a build whose embedded pair is NOT public sends the static token (no positive evidence to block)', async () => {
      delete Config.REACT_APP_AQ_KEYS_PUBLIC;
      const underlying = setup([statusResponse(500), statusResponse(500)]);
      const st = staticToken();
      await global.fetch('https://api.test/api/private', {headers: {'aq-encrypted-key': st}});
      expect(sentTo(underlying, 'https://api.test/api/private')[0][1].headers['aq-encrypted-key']).toBe(st);
      expect(Toast.show).not.toHaveBeenCalled();
    });

    it('a failed first fetch is retried once (forced) and the request gets the issued token', async () => {
      const underlying = setup([statusResponse(500)]);
      await global.fetch('https://ccxt.test/rebalance/x', {
        method: 'POST',
        headers: {'aq-encrypted-key': staticToken()},
      });
      expect(sentTo(underlying, 'https://ccxt.test/rebalance/x')[0][1].headers['aq-encrypted-key']).toBe('issued-1');
    });

    it('the forced retry is throttled across requests', async () => {
      const underlying = setup([statusResponse(500), statusResponse(500), statusResponse(500)]);
      const call = () =>
        global.fetch('https://api.test/api/private', {headers: {'aq-encrypted-key': staticToken()}});
      await expect(call()).rejects.toMatchObject({code: 'APP_SESSION_REQUIRED'});
      expect(tokenCalls(underlying)).toBe(2);
      await expect(call()).rejects.toMatchObject({code: 'APP_SESSION_REQUIRED'});
      expect(tokenCalls(underlying)).toBe(2); // in back-off and the retry gap has not elapsed
      expect(sentTo(underlying, 'https://api.test/api/private')).toHaveLength(0);
    });

    it('public pre-login routes still leave with the static token', async () => {
      const underlying = setup([statusResponse(500), statusResponse(500), statusResponse(500)]);
      const st = staticToken();
      await global.fetch('https://api.test/api/admin/frontend-config', {headers: {'aq-encrypted-key': st}});
      await global.fetch('https://ccxt.test//misc/pdfs?advisor=x', {headers: {'aq-encrypted-key': st}});
      expect(sentTo(underlying, 'https://api.test/api/admin/frontend-config')[0][1].headers['aq-encrypted-key']).toBe(st);
      expect(sentTo(underlying, 'https://ccxt.test//misc/pdfs?advisor=x')[0][1].headers['aq-encrypted-key']).toBe(st);
    });

    it('server says the feature is off (503): static token, no error (rollback lever)', async () => {
      const underlying = setup([statusResponse(503)]);
      const st = staticToken();
      await global.fetch('https://api.test/api/private', {headers: {'aq-encrypted-key': st}});
      expect(sentTo(underlying, 'https://api.test/api/private')[0][1].headers['aq-encrypted-key']).toBe(st);
      expect(ast.isAppSessionServerDisabled()).toBe(true);
    });

    it('client kill switch: static token, never an error', async () => {
      Config.REACT_APP_APP_SESSION_TOKENS = 'false';
      mockAuth.currentUser = user();
      const st = staticToken();
      expect(await ast.upgradeTokenFor('https://api.test/api/private', st, 'prod', 'GET')).toBeNull();
    });
  });
});
