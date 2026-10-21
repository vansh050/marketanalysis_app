/**
 * 2026-10-21 (Kyzen): a tracked request made before sign-in left a settled
 * null promise in `tokenRequest`, so every later request in the process went
 * out without a bearer — the public strategy endpoint then served the
 * marketing-only projection and "Target mix" was empty.
 */
const mockAuth = {currentUser: null};
const mockRequestHandlers = [];

jest.mock('@react-native-firebase/auth', () => ({getAuth: () => mockAuth}));
jest.mock('../utils/serverConfig', () => ({
  __esModule: true,
  default: {server: {baseUrl: 'https://api.test/'}, ccxtServer: {baseUrl: 'https://ccxt.test/'}},
}));
jest.mock('../components/EventEmitter', () => ({__esModule: true, default: {emit: jest.fn()}}));
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    interceptors: {
      request: {use: fn => mockRequestHandlers.push(fn)},
      response: {use: jest.fn()},
    },
  },
}));

const {installAuthTokenInterceptor} = require('../utils/authTokenInterceptor');

describe('auth token interceptor — request before sign-in', () => {
  beforeAll(() => installAuthTokenInterceptor());

  it('attaches the bearer once the user signs in after an unauthenticated request', async () => {
    const send = mockRequestHandlers[0];
    const before = await send({url: 'https://api.test/api/admin/frontend-config', headers: {}});
    expect(before.headers.Authorization).toBeUndefined();

    mockAuth.currentUser = {getIdToken: jest.fn().mockResolvedValue('tok-1')};
    const after = await send({url: 'https://api.test/api/model-portfolio/x', headers: {}});
    expect(after.headers.Authorization).toBe('Bearer tok-1');
  });
});
