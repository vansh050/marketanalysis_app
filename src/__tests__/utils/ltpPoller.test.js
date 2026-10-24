/**
 * ltpPoller: the price source for the old price helpers after the socket.io
 * feed on ccxt.alphaquark.in went away. Polls market-data/ltp (via
 * fetchLTPBatch) only for symbols with listeners.
 */
jest.mock('react-native', () => ({AppState: {currentState: 'active', addEventListener: jest.fn(() => ({remove: jest.fn()}))}}));
const mockBatch = jest.fn();
jest.mock('../../utils/marketDataLTP', () => ({
  fetchLTPBatch: (...a) => mockBatch(...a),
  fetchLTP: jest.fn(async () => 101),
}));

const poller = require('../../utils/ltpPoller');
const serverConfig = require('../../utils/serverConfig').default;

beforeEach(() => {
  jest.useFakeTimers();
  poller._resetLTPPoller();
  mockBatch.mockReset();
  mockBatch.mockResolvedValue({});
});
afterEach(() => {
  poller._resetLTPPoller();
  jest.useRealTimers();
});

const flush = () => Promise.resolve().then(() => Promise.resolve());

test('polls only subscribed symbols and notifies listeners on change', async () => {
  mockBatch.mockResolvedValue({'RELIANCE-EQ': 2500});
  const cb = jest.fn();
  poller.subscribeLTP('RELIANCE-EQ', 'NSE', cb);
  await flush();
  expect(mockBatch).toHaveBeenCalledWith([{symbol: 'RELIANCE-EQ', exchange: 'NSE'}]);
  expect(cb).toHaveBeenCalledWith(2500);
  expect(poller.getLastLTP('reliance-eq')).toBe(2500);

  cb.mockClear();
  jest.advanceTimersByTime(poller.POLL_INTERVAL_MS);
  await flush();
  expect(cb).not.toHaveBeenCalled(); // unchanged price is not re-emitted
});

test('a symbol stays polled until every subscriber has released it', async () => {
  const releaseA = poller.subscribeLTP('TCS-EQ', 'NSE', jest.fn());
  const releaseB = poller.watchLTP('TCS-EQ', 'NSE');
  releaseA();
  mockBatch.mockClear();
  jest.advanceTimersByTime(poller.POLL_INTERVAL_MS);
  await flush();
  expect(mockBatch).toHaveBeenCalledTimes(1);
  releaseB();
  mockBatch.mockClear();
  jest.advanceTimersByTime(poller.POLL_INTERVAL_MS * 3);
  await flush();
  expect(mockBatch).not.toHaveBeenCalled();
});

test('ignores zero, negative and non-numeric prices', async () => {
  mockBatch.mockResolvedValue({'INFY-EQ': 0, 'WIPRO-EQ': 'x'});
  const cb = jest.fn();
  poller.subscribeLTP('INFY-EQ', 'NSE', cb);
  poller.subscribeLTP('WIPRO-EQ', 'NSE', cb);
  await flush();
  expect(cb).not.toHaveBeenCalled();
});

test('websocketPrice getters read the poller (no socket.io)', async () => {
  mockBatch.mockResolvedValue({'SBIN-EQ': 800});
  const wp = require('../../components/AdviceScreenComponents/DynamicText/websocketPrice');
  const total = wp.calculateTotalAmount([{transactionType: 'BUY', tradingSymbol: 'SBIN-EQ', quantity: 2}]);
  expect(total).toBe('0.00');
  poller.watchLTP('SBIN-EQ', 'NSE');
  await flush();
  expect(wp.getLastKnownPrice('SBIN-EQ')).toBe(800);
  expect(wp.calculateTotalAmount([{transactionType: 'BUY', tradingSymbol: 'SBIN-EQ', quantity: 2}])).toBe('1600.00');
});

test('nothing in the app config points at ccxt.alphaquark.in', () => {
  expect(JSON.stringify(serverConfig)).not.toMatch(/ccxt\.alphaquark\.in/);
});
