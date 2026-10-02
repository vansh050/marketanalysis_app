const mockHandlers = {};
const mockSocket = {
  connected: true,
  on: jest.fn((event, handler) => {
    mockHandlers[event] = handler;
  }),
  emit: jest.fn(),
  removeAllListeners: jest.fn(),
  disconnect: jest.fn(),
};
const mockSetLTP = jest.fn();
const mockGetLTP = jest.fn();
const mockPost = jest.fn(() => Promise.resolve({data: {}}));
const mockFetchLTPBatch = jest.fn(() =>
  Promise.resolve({'PRINOX-EQ': 218.45}),
);

jest.mock('socket.io-client', () => ({io: jest.fn(() => mockSocket)}));
jest.mock('axios', () => ({post: (...args) => mockPost(...args)}));
jest.mock('../components/AdviceScreenComponents/DynamicText/useLtpStore', () => ({
  __esModule: true,
  default: {getState: () => ({setLTP: mockSetLTP, getLTP: mockGetLTP})},
}));
jest.mock('../utils/serverConfig', () => ({
  __esModule: true,
  default: {websocket: {baseUrl: 'https://quotes.example/'}},
}));
jest.mock('../utils/accountEmail', () => ({
  getAccountEmail: () => 'customer@example.test',
}));
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    currentUser: {getIdToken: () => Promise.resolve('signed-token')},
  }),
}));
jest.mock('../utils/marketDataLTP', () => ({
  fetchLTPBatch: (...args) => mockFetchLTPBatch(...args),
}));

import WebSocketManager from '../components/AdviceScreenComponents/DynamicText/WebSocketManager';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('recommendation WebSocket manager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetLTP.mockReturnValue(undefined);
  });

  afterEach(() => {
    WebSocketManager.getInstance().disconnect();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('authenticates, subscribes, and immediately joins the symbol room', async () => {
    const manager = WebSocketManager.getInstance();
    const subscription = manager.subscribeToAllSymbols([
      {Symbol: 'prinox-eq', Exchange: 'nse'},
    ]);

    mockHandlers.connect();
    jest.advanceTimersByTime(200);
    await subscription;

    expect(mockPost).toHaveBeenCalledWith(
      'https://quotes.example/subscribe-array',
      expect.objectContaining({
        userEmail: 'customer@example.test',
        symbolExchange: [{symbol: 'PRINOX-EQ', exchange: 'NSE'}],
      }),
      {headers: {Authorization: 'Bearer signed-token'}},
    );
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_symbols', {
      symbols: [{symbol: 'PRINOX-EQ', exchange: 'NSE'}],
    });
  });

  test('hydrates the recommendation store from REST when no tick arrives', async () => {
    const manager = WebSocketManager.getInstance();
    const subscription = manager.subscribeToAllSymbols([
      {Symbol: 'PRINOX-EQ', Exchange: 'NSE'},
    ]);

    mockHandlers.connect();
    jest.advanceTimersByTime(200);
    await subscription;
    jest.advanceTimersByTime(4000);
    await flushPromises();

    expect(mockFetchLTPBatch).toHaveBeenCalledWith([
      {symbol: 'PRINOX-EQ', exchange: 'NSE'},
    ]);
    expect(mockSetLTP).toHaveBeenCalledWith('PRINOX-EQ', 218.45);
  });
});
