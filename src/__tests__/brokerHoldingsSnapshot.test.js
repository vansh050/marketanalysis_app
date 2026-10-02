const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const {
  loadBrokerHoldingsSnapshot,
  saveBrokerHoldingsSnapshot,
} = require('../utils/brokerHoldingsSnapshot');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe('broker holdings snapshot cache', () => {
  beforeEach(() => {
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
  });

  test('stores the verified broker snapshot with its refresh time', async () => {
    await saveBrokerHoldingsSnapshot({
      email: 'kuldeep@example.com',
      broker: 'Zerodha',
      holdings: {holding: [{symbol: 'INFY', quantity: 2}]},
      refreshedAt: '2026-09-04T08:15:00.000Z',
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@alphaquark/broker-holdings-snapshot:v1',
      expect.stringContaining('2026-09-04T08:15:00.000Z'),
    );
  });

  test('does not expose another account or broker snapshot', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        email: 'kuldeep@example.com',
        broker: 'Zerodha',
        holdings: {holding: [{symbol: 'INFY'}]},
        refreshedAt: '2026-09-04T08:15:00.000Z',
      }),
    );

    await expect(
      loadBrokerHoldingsSnapshot('other@example.com', 'Zerodha'),
    ).resolves.toBeNull();
    await expect(
      loadBrokerHoldingsSnapshot('kuldeep@example.com', 'Upstox'),
    ).resolves.toBeNull();
    await expect(
      loadBrokerHoldingsSnapshot('kuldeep@example.com', 'Zerodha'),
    ).resolves.toMatchObject({
      broker: 'Zerodha',
      refreshedAt: '2026-09-04T08:15:00.000Z',
    });
  });
});
