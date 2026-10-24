/**
 * Exercise the real Axios XHR adapter and app interceptors together. Most
 * service tests mock Axios, which cannot detect dependency-upgrade regressions.
 * Every response stays in this fake transport; no backend or broker is called.
 * See docs/APP_ARCHITECTURE.md, JavaScript dependency security baseline.
 */
const mockAuth = {currentUser: null};
let mockResponses;
let mockRequests;

jest.mock('axios', () => jest.requireActual('axios'));
jest.mock('@react-native-firebase/auth', () => ({getAuth: () => mockAuth}));
jest.mock('react-native-device-info', () => ({
  getVersion: () => '3.9.197',
  getBuildNumber: () => '197',
}));
jest.mock('../components/EventEmitter', () => ({
  __esModule: true,
  default: {emit: jest.fn()},
}));
jest.mock('../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://api.test/'},
    ccxtServer: {baseUrl: 'https://broker.test/'},
  },
}));
jest.mock('../utils/appSessionToken', () => ({
  isIssuedAppSessionToken: value => value === 'test-issued-token',
  issuedTokenAllowedFor: (url, _token, tenant) =>
    tenant === 'prod' &&
    (url.startsWith('https://api.test/') || url.startsWith('https://broker.test/')),
  clearAppSessionToken: jest.fn(),
  getStaticToken: () => 'test-legacy-token',
  upgradeTokenFor: async () => null,
  ensureIssuedAppSessionToken: async () => 'test-fresh-issued-token',
}));

class FakeXMLHttpRequest {
  constructor() {
    this.onloadend = null;
    this.headers = {};
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name, value) {
    this.headers[name] = value;
  }

  getAllResponseHeaders() {
    return 'content-type: application/json\r\n';
  }

  send(body) {
    mockRequests.push({method: this.method, url: this.url, headers: this.headers, body});
    const response = mockResponses.shift() || {status: 200, data: {ok: true}};
    this.status = response.status;
    this.statusText = response.status === 200 ? 'OK' : 'Unauthorized';
    this.responseText = JSON.stringify(response.data);
    this.responseURL = this.url;
    this.readyState = 4;
    Promise.resolve().then(() => this.onloadend && this.onloadend());
  }

  abort() {
    if (this.onabort) this.onabort();
  }
}

describe('security dependency upgrades with the native HTTP transport', () => {
  let axios;
  let previousXHR;

  beforeEach(() => {
    jest.resetModules();
    mockResponses = [];
    mockRequests = [];
    mockAuth.currentUser = null;
    previousXHR = global.XMLHttpRequest;
    global.XMLHttpRequest = FakeXMLHttpRequest;
    axios = require('axios');
    axios.defaults.adapter = 'xhr';
    require('../utils/authTokenInterceptor');
  });

  afterEach(() => {
    global.XMLHttpRequest = previousXHR;
  });

  test('a request before sign-in does not prevent later Firebase authentication', async () => {
    await axios.get('https://api.test/api/admin/frontend-config');
    expect(mockRequests[0].headers.Authorization).toBeUndefined();

    mockAuth.currentUser = {getIdToken: jest.fn().mockResolvedValue('test-firebase-token')};
    const result = await axios.get('https://api.test/api/model-portfolio/example', {
      headers: {'X-Advisor-Subdomain': 'prod', 'aq-encrypted-key': 'test-issued-token'},
    });
    expect(result.data).toEqual({ok: true});
    expect(mockRequests[1].headers).toMatchObject({
      Authorization: 'Bearer test-firebase-token',
      'X-Advisor-Subdomain': 'prod',
      'aq-encrypted-key': 'test-issued-token',
      'X-App-Version': '3.9.197+197',
    });
  });

  test('order POST serialization preserves method, identity, request id and JSON body', async () => {
    mockAuth.currentUser = {getIdToken: jest.fn().mockResolvedValue('test-firebase-token')};
    const body = {requestId: 'test-request', trades: [{quantity: 2, clientTradeId: 'test-leg'}]};
    await axios.post('https://api.test/api/process-trades/order-place', body, {
      headers: {
        'X-Advisor-Subdomain': 'prod',
        'aq-encrypted-key': 'test-issued-token',
        'x-request-id': 'test-request',
      },
    });
    expect(mockRequests).toHaveLength(1);
    expect(mockRequests[0].method).toBe('POST');
    expect(JSON.parse(mockRequests[0].body)).toEqual(body);
    expect(mockRequests[0].headers).toMatchObject({
      Authorization: 'Bearer test-firebase-token',
      'Content-Type': 'application/json',
      'x-request-id': 'test-request',
      'X-Advisor-Subdomain': 'prod',
    });
  });

  test('customer GET refreshes Firebase authentication once and stops after a second 401', async () => {
    mockAuth.currentUser = {getIdToken: jest.fn(force =>
      Promise.resolve(force ? 'test-refreshed-token' : 'test-cached-token'))};
    mockResponses.push(
      {status: 401, data: {message: 'test rejection'}},
      {status: 401, data: {message: 'test rejection'}},
    );
    await expect(axios.get('https://api.test/api/user/profile')).rejects.toMatchObject({
      response: {status: 401},
    });
    expect(mockRequests).toHaveLength(2);
    expect(mockRequests[0].headers.Authorization).toBe('Bearer test-cached-token');
    expect(mockRequests[1].headers.Authorization).toBe('Bearer test-refreshed-token');
  });

  test('a broker order rejection is not replayed', async () => {
    mockAuth.currentUser = {getIdToken: jest.fn().mockResolvedValue('test-firebase-token')};
    mockResponses.push({status: 401, data: {message: 'Broker session expired'}});
    await expect(axios.post('https://broker.test/orders/process-trade', {quantity: 2}, {
      headers: {'X-Advisor-Subdomain': 'prod', 'aq-encrypted-key': 'test-issued-token'},
    })).rejects.toMatchObject({response: {status: 401}});
    expect(mockRequests).toHaveLength(1);
  });

  test('a pre-handler app-token rejection retries once with a fresh issued token', async () => {
    mockResponses.push({status: 401, data: {code: 'APP_SESSION_INVALID'}});
    await axios.post('https://api.test/api/test', {requestId: 'test-request'}, {
      headers: {'X-Advisor-Subdomain': 'prod', 'aq-encrypted-key': 'test-issued-token'},
    });
    expect(mockRequests).toHaveLength(2);
    expect(mockRequests[0].headers['aq-encrypted-key']).toBe('test-issued-token');
    expect(mockRequests[1].headers['aq-encrypted-key']).toBe('test-fresh-issued-token');
    expect(mockRequests[1].body).toBe(mockRequests[0].body);
  });

  test('third-party requests do not receive Firebase or issued app-session credentials', async () => {
    mockAuth.currentUser = {getIdToken: jest.fn().mockResolvedValue('test-firebase-token')};
    await axios.get('https://third-party.test/report', {
      headers: {'aq-encrypted-key': 'test-issued-token'},
    });
    expect(mockRequests[0].headers.Authorization).toBeUndefined();
    expect(mockRequests[0].headers['aq-encrypted-key']).toBe('test-legacy-token');
    expect(mockAuth.currentUser.getIdToken).not.toHaveBeenCalled();
  });

  test('an inherited method cannot turn a default GET into DELETE', async () => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'method');
    try {
      Object.defineProperty(Object.prototype, 'method', {
        configurable: true, writable: true, value: 'delete',
      });
      await axios({url: 'https://api.test/api/test'});
    } finally {
      if (previous) Object.defineProperty(Object.prototype, 'method', previous);
      else delete Object.prototype.method;
    }
    expect(mockRequests[0].method).toBe('GET');
  });
});

describe('Lodash security fixes used by the dependency baseline', () => {
  test('template imports reject an invalid identifier before compiling code', () => {
    const lodash = require('lodash');
    expect(() => lodash.template('test', {imports: {'unsafe = 1': undefined}}))
      .toThrow('Invalid `imports` option');
  });

  test('array-wrapped unset paths cannot delete an Object.prototype property', () => {
    const lodash = require('lodash');
    const marker = '__aqDependencyReview';
    try {
      Object.defineProperty(Object.prototype, marker, {value: true, configurable: true});
      expect(lodash.unset({}, [['constructor'], ['prototype'], marker])).toBe(false);
      expect(Object.prototype[marker]).toBe(true);
    } finally {
      delete Object.prototype[marker];
    }
  });
});
